import { describe, it, expect } from 'vitest';
import { applePhotoIdentifier, appleVideoIdentifier, heifMotionOffset } from '../publishLivePhoto';
const encode = (value: string) => new TextEncoder().encode(value);
const identifier = '12345678-1234-1234-1234-123456789abc';
function box(type: string | number, payload: Uint8Array): Uint8Array { const bytes = new Uint8Array(8 + payload.length); const view = new DataView(bytes.buffer); view.setUint32(0, bytes.length); if (typeof type === 'string') bytes.set(encode(type), 4); else view.setUint32(4, type); bytes.set(payload, 8); return bytes; }
function join(...values: Uint8Array[]): Uint8Array { const bytes = new Uint8Array(values.reduce((sum, value) => sum + value.length, 0)); let at = 0; for (const value of values) { bytes.set(value, at); at += value.length; } return bytes; }
describe('原始实况关联', () => {
  it('只读取 Apple MakerNote 的 ContentIdentifier，不拿任意 UUID 或文件名配对', () => {
    const bytes = new Uint8Array(80), view = new DataView(bytes.buffer); bytes.set(encode('Apple iOS\0')); bytes.set([77, 77], 12); view.setUint16(14, 1); view.setUint16(16, 0x11); view.setUint16(18, 2); view.setUint32(20, 37); view.setUint32(24, 32); bytes.set(encode(identifier + '\0'), 32);
    expect(applePhotoIdentifier(bytes)).toBe(identifier); view.setUint16(16, 0x15); expect(applePhotoIdentifier(bytes)).toBeUndefined(); expect(applePhotoIdentifier(encode(identifier))).toBeUndefined();
  });
  it('MOV 关联标识必须来自 QuickTime 的对应键，而非视频中的任意文字', () => {
    const keysHeader = new Uint8Array(8); new DataView(keysHeader.buffer).setUint32(4, 1);
    const keys = box('keys', join(keysHeader, box('mdta', encode('com.apple.quicktime.content.identifier'))));
    const values = box('ilst', box(1, box('data', join(new Uint8Array(8), encode(identifier)))));
    const movie = box('moov', box('meta', join(new Uint8Array(4), keys, values)));
    expect(appleVideoIdentifier(movie)).toBe(identifier); expect(appleVideoIdentifier(encode('com.apple.quicktime.content.identifier ' + identifier))).toBeUndefined(); expect(appleVideoIdentifier(movie.slice(0, -1))).toBeUndefined();
  });
  it('HEIF 内嵌实况只接受合法 mpvd 内的原始媒体，不把静态 HEIC 判成实况', () => {
    const header = box('ftyp', encode('heic0000')), movie = box('ftyp', encode('mp420000')), data = join(header, box('mpvd', movie));
    expect(heifMotionOffset(data)).toBe(header.length + 8); expect(heifMotionOffset(header)).toBe(-1); expect(heifMotionOffset(join(header, box('mpvd', encode('not-video'))))).toBe(-1);
  });
});
