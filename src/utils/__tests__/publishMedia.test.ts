import { describe, it, expect } from 'vitest';
import { motionPhotoOffset, movePublishImage } from '../publishMedia';
describe('发布图片处理', () => {
  it('识别 JPEG 尾部实况视频且不误判普通图片', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 1, 2, 0xff, 0xd9]);
    const mp4 = new Uint8Array([0, 0, 0, 12, 102, 116, 121, 112, 105, 115, 111, 109]);
    expect(motionPhotoOffset(new Uint8Array([...jpeg, ...mp4]))).toBe(-1);
    expect(motionPhotoOffset(jpeg)).toBe(-1);
    expect(motionPhotoOffset(mp4)).toBe(-1);
  });
  it('按 XMP 偏移识别视频并保留原始字节边界', () => {
    const metadata = new TextEncoder().encode('GCamera:MicroVideoOffset="12"');
    const jpeg = new Uint8Array([0xff, 0xd8, ...metadata, 0xff, 0xd9, 0, 0]);
    const mp4 = new Uint8Array([0, 0, 0, 12, 102, 116, 121, 112, 105, 115, 111, 109]);
    expect(motionPhotoOffset(new Uint8Array([...jpeg, ...mp4]))).toBe(jpeg.length);
  });
  it('排序时视频仍跟随封面移动，非法索引不会删除图片', () => {
    const images = [{ preview: '甲', liveEnabled: true }, { preview: '乙' }, { preview: '丙' }];
    const result = movePublishImage(images, 0, 2);
    expect(result.map((image) => image.preview)).toEqual(['乙', '丙', '甲']);
    expect(result[2].liveEnabled).toBe(true);
    expect(images[0].preview).toBe('甲');
    expect(movePublishImage(images, -1, 2)).toBe(images);
  });
});
