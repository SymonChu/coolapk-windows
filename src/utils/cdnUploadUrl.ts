/** 仅升级酷安 CDN 的地址，保留路径、查询参数和非酷安地址。 */
export function normalizeCdnUploadUrl(raw: string): string {
  if (!raw) return '';
  try {
    const url = new URL(raw.startsWith('//') ? `https:${raw}` : raw);
    if (url.hostname === 'image.coolapk.com' && url.protocol === 'http:') {
      return raw.replace(/^http:/i, 'https:');
    }
    if (raw.startsWith('//') && url.hostname === 'image.coolapk.com') return `https:${raw}`;
  } catch { /* 保留服务端原始值，由现有任务错误流程处理。 */ }
  return raw;
}
