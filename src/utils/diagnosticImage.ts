import { deflateSync, inflateSync } from 'fflate';

/** A normal PNG followed by a standard ZIP using maximum DEFLATE compression. */
export const MAX_DIAGNOSTIC_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_DIAGNOSTIC_LOG_BYTES = 512 * 1024;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const FORMAT = 'coolapk-diagnostics-v1';
export interface DiagnosticReport {
  format: typeof FORMAT;
  version: string;
  platform: string;
  createdAt: string;
  log: string;
}

/** Display report timestamps in Beijing time, regardless of the device's timezone. */
export function formatDiagnosticTime(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return '时间未知';
  return `${new Date(timestamp + 8 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ')} 北京时间`;
}

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngEnd(bytes: Uint8Array): number {
  if (!PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) throw new Error('请选择原始 PNG 日志图片');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    const end = offset + 12 + length;
    if (end > bytes.length) break;
    if (view.getUint32(offset + 4) === 0x49454e44 && length === 0) return end;
    offset = end;
  }
  throw new Error('PNG 图片不完整');
}

export function packDiagnosticImage(png: Uint8Array, report: Omit<DiagnosticReport, 'format'>): Uint8Array {
  const prefix = png.subarray(0, pngEnd(png));
  const log = encoder.encode(report.log);
  if (!log.length || log.length > MAX_DIAGNOSTIC_LOG_BYTES) throw new Error('日志为空或超过 512 KB');
  const { log: _, ...metadata } = report;
  const files = [
    { name: encoder.encode('manifest.json'), data: encoder.encode(JSON.stringify({ ...metadata, format: FORMAT })) },
    { name: encoder.encode('diagnostic.log'), data: log },
  ].map(file => ({ ...file, compressed: deflateSync(file.data, { level: 9 }) }));
  const localSize = files.reduce((sum, file) => sum + 30 + file.name.length + file.compressed.length, 0);
  const centralSize = files.reduce((sum, file) => sum + 46 + file.name.length, 0);
  const output = new Uint8Array(prefix.length + localSize + centralSize + 22);
  if (output.length > MAX_DIAGNOSTIC_IMAGE_BYTES) throw new Error('日志图片超过 2 MB');
  output.set(prefix);
  const view = new DataView(output.buffer);
  let offset = prefix.length;
  const entries: Array<{ offset: number; crc: number }> = [];
  for (const file of files) {
    const crc = crc32(file.data);
    entries.push({ offset, crc });
    view.setUint32(offset, 0x04034b50, true);
    view.setUint16(offset + 4, 20, true);
    view.setUint16(offset + 8, 8, true);
    view.setUint16(offset + 12, 33, true); // ZIP minimum date: 1980-01-01.
    view.setUint32(offset + 14, crc, true);
    view.setUint32(offset + 18, file.compressed.length, true);
    view.setUint32(offset + 22, file.data.length, true);
    view.setUint16(offset + 26, file.name.length, true);
    output.set(file.name, offset + 30);
    output.set(file.compressed, offset + 30 + file.name.length);
    offset += 30 + file.name.length + file.compressed.length;
  }
  const centralOffset = offset;
  files.forEach((file, index) => {
    view.setUint32(offset, 0x02014b50, true);
    view.setUint16(offset + 4, 20, true);
    view.setUint16(offset + 6, 20, true);
    view.setUint16(offset + 10, 8, true);
    view.setUint16(offset + 14, 33, true);
    view.setUint32(offset + 16, entries[index]!.crc, true);
    view.setUint32(offset + 20, file.compressed.length, true);
    view.setUint32(offset + 24, file.data.length, true);
    view.setUint16(offset + 28, file.name.length, true);
    view.setUint32(offset + 42, entries[index]!.offset, true);
    output.set(file.name, offset + 46);
    offset += 46 + file.name.length;
  });
  view.setUint32(offset, 0x06054b50, true);
  view.setUint16(offset + 8, files.length, true);
  view.setUint16(offset + 10, files.length, true);
  view.setUint32(offset + 12, centralSize, true);
  view.setUint32(offset + 16, centralOffset, true);
  return output;
}

/** Read only the two known entries with bounded decompression buffers; support old stored ZIPs. */
export function unpackDiagnosticImage(bytes: Uint8Array): DiagnosticReport {
  if (bytes.length > MAX_DIAGNOSTIC_IMAGE_BYTES) throw new Error('日志图片超过 2 MB');
  const start = pngEnd(bytes);
  const end = bytes.length - 22;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const invalid = () => new Error('未找到完整日志附件，请使用原图，不能使用缩略图或截图');
  if (end < start || view.getUint32(end, true) !== 0x06054b50) throw invalid();
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true)
    || view.getUint16(end + 8, true) !== 2 || view.getUint16(end + 10, true) !== 2
    || view.getUint16(end + 20, true)) throw invalid();
  let cursor = view.getUint32(end + 16, true);
  const centralStart = cursor;
  if (cursor < start || cursor + view.getUint32(end + 12, true) !== end) throw invalid();
  const result: Record<string, string> = {};
  for (let entry = 0; entry < 2; entry++) {
    if (cursor + 46 > end || view.getUint32(cursor, true) !== 0x02014b50) throw invalid();
    const size = view.getUint32(cursor + 24, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const method = view.getUint16(cursor + 10, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const next = cursor + 46 + nameLength + view.getUint16(cursor + 30, true) + view.getUint16(cursor + 32, true);
    if (next > end || size > MAX_DIAGNOSTIC_LOG_BYTES || view.getUint16(cursor + 8, true)
      || ![0, 8].includes(method) || (method === 0 && compressedSize !== size)) throw invalid();
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    if (!['manifest.json', 'diagnostic.log'].includes(name) || name in result) throw invalid();
    const local = view.getUint32(cursor + 42, true);
    if (local < start || local + 30 > centralStart || view.getUint32(local, true) !== 0x04034b50
      || view.getUint16(local + 6, true) || view.getUint16(local + 8, true) !== method) throw invalid();
    const localNameLength = view.getUint16(local + 26, true);
    const dataStart = local + 30 + localNameLength + view.getUint16(local + 28, true);
    if (dataStart + compressedSize > centralStart || view.getUint32(local + 18, true) !== compressedSize
      || view.getUint32(local + 22, true) !== size
      || decoder.decode(bytes.subarray(local + 30, local + 30 + localNameLength)) !== name) throw invalid();
    const compressed = bytes.subarray(dataStart, dataStart + compressedSize);
    let data: Uint8Array;
    try { data = method === 8 ? inflateSync(compressed, { out: new Uint8Array(size) }) : compressed; }
    catch { throw new Error('日志附件校验失败'); }
    if (data.length !== size) throw new Error('日志附件校验失败');
    const crc = crc32(data);
    if (crc !== view.getUint32(cursor + 16, true) || crc !== view.getUint32(local + 14, true)) throw new Error('日志附件校验失败');
    result[name] = decoder.decode(data);
    cursor = next;
  }
  if (cursor !== end || !result['diagnostic.log']) throw invalid();
  const manifest = JSON.parse(result['manifest.json'] || '{}');
  if (manifest.format !== FORMAT || !['version', 'platform', 'createdAt'].every(key => typeof manifest[key] === 'string' && manifest[key].length <= 100)) throw invalid();
  return { format: FORMAT, version: manifest.version, platform: manifest.platform, createdAt: manifest.createdAt, log: result['diagnostic.log'] };
}
