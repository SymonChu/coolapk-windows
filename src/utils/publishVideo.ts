import { readFilePreview } from './publishMedia';
export interface PublishVideo { file: File; cover: File; coverPreview: string; preview: string; duration: number; mediaUrl?: string; mediaInfo?: string }
// 读取原视频并截取封面，不合成或改变视频内容。
export async function preparePublishVideo(file: File): Promise<PublishVideo> {
  if (!/\.(mp4|mov)$/i.test(file.name)) throw new Error('请选择 MP4 或 MOV 视频');
  if (file.size > 256 * 1024 * 1024) throw new Error('请选择不超过 256 MB 的视频');
  const preview = URL.createObjectURL(file), video = document.createElement('video');
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => finish(new Error('读取视频超时')), 15000);
      function finish(error?: Error) { clearTimeout(timer); video.onloadeddata = null; video.onerror = null; error ? reject(error) : resolve(); }
      video.onloadeddata = () => finish(); video.onerror = () => finish(new Error('无法读取视频，请使用当前系统支持的 MP4 或 MOV 编码'));
      video.preload = 'auto'; video.muted = true; video.src = preview;
    });
    if (!Number.isFinite(video.duration) || video.duration <= 0 || !video.videoWidth || !video.videoHeight) throw new Error('视频信息无效');
    const duration = Math.round(video.duration * 1000), canvas = document.createElement('canvas');
    const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext('2d'); if (!context) throw new Error('无法生成视频封面');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('无法读取视频封面')), 'image/jpeg', 0.9));
    const cover = new File([blob], 'cover.jpg', { type: 'image/jpeg' });
    return { file, cover, coverPreview: await readFilePreview(cover), preview, duration };
  } catch (error) { URL.revokeObjectURL(preview); throw error; }
  finally { video.removeAttribute('src'); video.load(); }
}
