import { applePhotoIdentifier, appleVideoIdentifier, heifMotionOffset, mediaBoxes } from './publishLivePhoto';
export interface PublishImage { file?: File; preview: string; url?: string; liveVideo?: File; liveEnabled?: boolean; liveIdentifier?: string; hdr?: number }

// JPEG 动态照片将标准 MP4 追加在图片尾部；保留视频字节，封面只上传 JPEG 部分。
export function motionPhotoOffset(bytes: Uint8Array): number {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return -1;
  const header = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 131072)));
  const containerItem = Array.from(header.matchAll(/<[^>]+>/g)).find(match => /(?:Semantic=["']MotionPhoto["']|Mime=["']video\/mp4["'])/.test(match[0]))?.[0];
  const length = containerItem?.match(/Length=["'](\d+)["']/)?.[1] || header.match(/(?:MicroVideoOffset|MotionPhotoVideoLength)=["'](\d+)["']/)?.[1];
  const offset = length ? bytes.length - Number(length) : -1;
  const isMp4 = (at: number) => at >= 2 && at + 12 <= bytes.length && String.fromCharCode(...bytes.subarray(at + 4, at + 8)) === 'ftyp';
  if (isMp4(offset)) return offset;
  // 官方按实况元数据识别，普通图片尾部的任意 MP4 不能标成实况。
  if (!/MotionPhoto|MicroVideo/.test(header)) return -1;
  // 实况容器未给偏移时，只接受紧邻 JPEG 结束标记的标准 MP4。
  for (let at = 2; at + 12 <= bytes.length; at++) if (bytes[at - 2] === 0xff && bytes[at - 1] === 0xd9 && isMp4(at)) return at;
  return -1;
}

export function readFilePreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('读取图片失败')); reader.readAsDataURL(file); });
}

export async function preparePublishImage(file: File): Promise<PublishImage> {
  if (!file.type.startsWith('image/') && !/\.(heic|heif|jpe?g|png)$/i.test(file.name)) throw new Error('请选择图片文件');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const heif = /\.(heic|heif)$/i.test(file.name) || /image\/hei[cf]/.test(file.type);
  const offset = heif ? heifMotionOffset(bytes) : motionPhotoOffset(bytes);
  const liveIdentifier = applePhotoIdentifier(bytes);
  let image = offset >= 0 ? new File([bytes.slice(0, heif ? mediaBoxes(bytes).find(box => box.type === 'mpvd')!.at : offset)], file.name, { type: file.type || (heif ? 'image/heic' : 'image/jpeg') }) : file;
  // HEIC 仅解码静态封面用于显示和上传，动态片段始终保留原始拍摄字节。
  if (heif) { const { heicTo } = await import('heic-to/csp'); image = new File([await heicTo({ blob: image, type: 'image/jpeg', quality: 0.95 })], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }); }
  if (offset >= 0) {
    const liveVideo = new File([bytes.slice(offset)], file.name.replace(/\.[^.]+$/, '') + '.mp4', { type: 'video/mp4' });
    return { file: image, preview: await readFilePreview(image), liveVideo, liveEnabled: true, liveIdentifier };
  }
  return { file: image, preview: await readFilePreview(image), liveIdentifier, liveEnabled: liveIdentifier ? true : undefined };
}

// iPhone 原片通过真实内容标识匹配原始 MOV，不接受随意附加的视频。
export async function originalLiveCompanions(files: File[]): Promise<Map<string, File>> {
  const result = new Map<string, File>();
  for (const file of files.filter(value => /\.(mov|mp4)$/i.test(value.name))) {
    const identifier = appleVideoIdentifier(new Uint8Array(await file.arrayBuffer()));
    if (identifier && !result.has(identifier)) result.set(identifier, file);
  }
  return result;
}

// 拖动排序返回新数组，方便草稿监听完整变化。
export function movePublishImage(images: PublishImage[], from: number, to: number): PublishImage[] {
  if (from < 0 || to < 0 || from >= images.length || to >= images.length || from === to) return images;
  const result = [...images];
  result.splice(to, 0, result.splice(from, 1)[0]);
  return result;
}
