import { describe, expect, it } from 'vitest';
import { packDiagnosticImage, unpackDiagnosticImage, MAX_DIAGNOSTIC_LOG_BYTES, formatDiagnosticTime } from '../diagnosticImage';

const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII='), character => character.charCodeAt(0));
const report = { version: '1.28.0', platform: 'iOS', createdAt: '2026-10-01T04:00:00.000Z', log: '[INFO] 全文加载成功\n[WARN] request timeout' };

describe('diagnostic PNG ZIP attachments', () => {
  it('displays Beijing time across midnight and accepts timestamps with explicit offsets', () => {
    expect(formatDiagnosticTime('2026-10-01T04:04:54Z')).toBe('2026-10-01 12:04:54 北京时间');
    expect(formatDiagnosticTime('2026-10-01T20:04:54Z')).toBe('2026-10-02 04:04:54 北京时间');
    expect(formatDiagnosticTime('2026-10-01T12:04:54+08:00')).toBe('2026-10-01 12:04:54 北京时间');
  });
  it('retains the original PNG prefix and round trips a Unicode report', () => {
    const packed = packDiagnosticImage(png, report);
    expect(packed.subarray(0, png.length)).toEqual(png);
    expect(unpackDiagnosticImage(packed)).toEqual({ format: 'coolapk-diagnostics-v1', ...report });
  });
  it('rejects an ordinary image, thumbnails and truncated downloads', () => {
    expect(() => unpackDiagnosticImage(png)).toThrow('原图');
    const packed = packDiagnosticImage(png, report);
    expect(() => unpackDiagnosticImage(packed.subarray(0, packed.length - 1))).toThrow();
  });
  it('detects modified ZIP data via CRC', () => {
    const packed = packDiagnosticImage(png, report);
    packed[png.length + 30 + 'manifest.json'.length] ^= 1;
    expect(() => unpackDiagnosticImage(packed)).toThrow('校验失败');
  });
  it('rejects huge or empty logs before packing', () => {
    expect(() => packDiagnosticImage(png, { ...report, log: '' })).toThrow();
    expect(() => packDiagnosticImage(png, { ...report, log: 'x'.repeat(MAX_DIAGNOSTIC_LOG_BYTES + 1) })).toThrow();
  });
  it('compresses repetitive logs rather than storing the original text', () => {
    const log = '[WARN] request_failed get_feed_detail elapsed_ms=9200\n'.repeat(8000);
    const packed = packDiagnosticImage(png, { ...report, log });
    expect(packed.length).toBeLessThan(new TextEncoder().encode(log).length / 10);
    expect(unpackDiagnosticImage(packed).log).toBe(log);
  });
  it('rejects a forged central offset without allocating or extracting files', () => {
    const packed = packDiagnosticImage(png, report);
    new DataView(packed.buffer).setUint32(packed.length - 6, 0xffffffff, true);
    expect(() => unpackDiagnosticImage(packed)).toThrow();
  });
});
