// 仅读取原始实况媒体及其关联标识，绝不把任意图片与视频组合成实况。
const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function applePhotoIdentifier(bytes: Uint8Array): string | undefined {
  const signature = new TextEncoder().encode('Apple iOS\0');
  for (let start = 0; start + 16 < bytes.length; start++) {
    if (!signature.every((value, index) => bytes[start + index] === value)) continue;
    const little = bytes[start + 12] === 73 && bytes[start + 13] === 73;
    if (!little && !(bytes[start + 12] === 77 && bytes[start + 13] === 77)) continue;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const count = view.getUint16(start + 14, little);
    if (count > 512 || start + 16 + count * 12 > bytes.length) continue;
    for (let index = 0; index < count; index++) {
      const entry = start + 16 + index * 12;
      if (view.getUint16(entry, little) !== 0x11 || view.getUint16(entry + 2, little) !== 2) continue;
      const length = view.getUint32(entry + 4, little), at = start + view.getUint32(entry + 8, little);
      if (length < 36 || length > 128 || at + length > bytes.length) continue;
      const value = text(bytes.subarray(at, at + length)).replace(/\0.*$/, '').trim();
      if (uuid.test(value)) return value.toLowerCase();
    }
  }
}
interface Box { at: number; end: number; data: number; type: string }
export function mediaBoxes(bytes: Uint8Array, from = 0, end = bytes.length): Box[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), boxes: Box[] = [];
  for (let at = from; at + 8 <= end;) {
    let size = view.getUint32(at), header = 8;
    if (size === 1) { if (at + 16 > end) break; size = Number(view.getBigUint64(at + 8)); header = 16; }
    if (!size) size = end - at;
    if (size < header || !Number.isSafeInteger(size) || at + size > end) break;
    boxes.push({ at, end: at + size, data: at + header, type: text(bytes.subarray(at + 4, at + 8)) });
    at += size;
  }
  return boxes;
}
export function appleVideoIdentifier(bytes: Uint8Array): string | undefined {
  function visit(from: number, end: number, depth: number): string | undefined {
    if (depth > 6) return;
    for (const box of mediaBoxes(bytes, from, end)) {
      if (box.type === 'meta') {
        const children = mediaBoxes(bytes, box.data + 4, box.end), keys = children.find(child => child.type === 'keys'), values = children.find(child => child.type === 'ilst');
        if (!keys || !values || keys.data + 8 > keys.end) continue;
        let keyIndex = 0, index = 1;
        for (const key of mediaBoxes(bytes, keys.data + 8, keys.end)) { if (key.type === 'mdta' && text(bytes.subarray(key.data, key.end)) === 'com.apple.quicktime.content.identifier') keyIndex = index; index++; }
        for (const value of mediaBoxes(bytes, values.data, values.end)) {
          if (new DataView(bytes.buffer, bytes.byteOffset).getUint32(value.at + 4) !== keyIndex || !keyIndex) continue;
          const data = mediaBoxes(bytes, value.data, value.end).find(child => child.type === 'data');
          if (!data || data.data + 8 > data.end) continue;
          const identifier = text(bytes.subarray(data.data + 8, data.end)).replace(/\0.*$/, '').trim();
          if (uuid.test(identifier)) return identifier.toLowerCase();
        }
      } else if (['moov', 'udta'].includes(box.type)) { const value = visit(box.data, box.end, depth + 1); if (value) return value; }
    }
  }
  return visit(0, bytes.length, 0);
}
// HEIF 的 mpvd 容器直接保存相机拍摄的原始短片。
export function heifMotionOffset(bytes: Uint8Array): number {
  const box = mediaBoxes(bytes).find(value => value.type === 'mpvd');
  return box && text(bytes.subarray(box.data + 4, box.data + 8)) === 'ftyp' ? box.data : -1;
}
