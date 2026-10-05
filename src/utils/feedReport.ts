import { sanitizeCoolapkHtml } from './sanitizeHtml';

export function isFeedReportUrl(value: unknown): boolean {
  try {
    const url = new URL(String(value || ''));
    return url.origin === 'https://m.coolapk.com' && url.pathname === '/mp/do'
      && url.searchParams.get('c') === 'feed' && url.searchParams.get('m') === 'report'
      && ['feed', 'reply'].includes(url.searchParams.get('type') || '')
      && /^\d+$/.test(url.searchParams.get('id') || '');
  } catch { return false; }
}

// 只读取官方表单的数据；不执行网页脚本，也不将表单原始 HTML 注入应用。
export function parseFeedReport(html: string, url: string) {
  if (!isFeedReportUrl(url)) throw new Error('举报地址无效');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const form = doc.querySelector<HTMLFormElement>('form#report');
  if (!form) throw new Error(doc.querySelector('.weui-msg__desc')?.textContent?.trim() || '举报表单未加载，请检查登录状态后重试');
  const action = new URL(form.getAttribute('action') || '', url);
  if (action.origin !== 'https://m.coolapk.com' || action.pathname !== '/mp/do'
    || action.searchParams.get('c') !== 'feed' || action.searchParams.get('m') !== 'report') throw new Error('举报表单地址无效');
  const field = (name: string) => form.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.value || '';
  const target = new URL(url);
  const id = field('id'), type = field('type'), requestHash = field('requestHash');
  const reasons = Array.from(form.querySelectorAll<HTMLInputElement>('input[type="radio"][name="report_reason"]')).map(input => input.value).filter(Boolean);
  if (id !== target.searchParams.get('id') || type !== target.searchParams.get('type') || !requestHash || !reasons.length) throw new Error('举报表单数据不完整，请重试');
  const cells = doc.querySelector('.weui-cell__group .weui-cells');
  const avatar = cells?.querySelector('img')?.getAttribute('src') || '';
  const avatarUrl = avatar ? new URL(avatar, url) : null;
  return { id, type, requestHash, reasons, author: cells?.querySelector('.weui-cell__bd p')?.textContent?.trim() || '',
    avatar: avatarUrl && /^(http|https):$/.test(avatarUrl.protocol) ? avatarUrl.href.replace(/^http:/, 'https:') : '',
    content: sanitizeCoolapkHtml(cells?.querySelectorAll('.weui-cell__bd')[1]?.innerHTML.trim() || '') };
}
