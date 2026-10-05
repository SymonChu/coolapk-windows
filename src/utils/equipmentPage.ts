export interface EquipmentItem {
  name: string;
  image: string;
  url: string;
  ratingLabel: string;
  rating: string;
}

export interface EquipmentPageData {
  username: string;
  avatar: string;
  stats: { label: string; value: string }[];
  recent: EquipmentItem[];
  categories: { name: string; items: EquipmentItem[] }[];
  actions: { label: string; url: string }[];
}

export function isEquipmentPageUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && url.hostname === 'm.coolapk.com'
      && /^\/myDevice\/\d+\/?$/.test(url.pathname);
  } catch {
    return false;
  }
}

/** 只提取官方装备页的数据，网页脚本、样式和事件属性不进入渲染结果。 */
export function parseEquipmentPage(html: string, pageUrl: string): EquipmentPageData | null {
  if (!isEquipmentPageUrl(pageUrl)) return null;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, style, iframe, object, embed, [hidden]').forEach(el => el.remove());
  doc.querySelectorAll<HTMLElement>('[style]').forEach(el => {
    if (el.style.display === 'none' || el.style.visibility === 'hidden') el.remove();
  });
  const user = doc.querySelector('#user-info');
  const categories = doc.querySelector('#category-list');
  if (!user || !categories) return null;

  const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim() || '';
  const safeUrl = (raw: string | null | undefined, image = false): string => {
    if (!raw?.trim()) return '';
    try {
      const url = new URL(raw, pageUrl);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
      if (image) {
        if (url.hostname === 'coolapk.com' || url.hostname.endsWith('.coolapk.com')) url.protocol = 'https:';
      } else if (url.origin !== new URL(pageUrl).origin) return '';
      return url.href;
    } catch {
      return '';
    }
  };
  const item = (row: Element): EquipmentItem => {
    const link = row.querySelector('a');
    const rating = row.querySelector(':scope > div');
    return {
      name: text((link || row).querySelector('p')),
      image: safeUrl(row.querySelector('img')?.getAttribute('src'), true),
      url: safeUrl(link?.getAttribute('href')),
      ratingLabel: text(rating?.querySelector('p')),
      rating: text(rating?.querySelector('p:nth-of-type(2)')),
    };
  };
  const stats: EquipmentPageData['stats'] = [];
  doc.querySelectorAll('#rating p').forEach((el, index, rows) => {
    if (index % 2 === 0 && rows[index + 1]) stats.push({ label: text(el), value: text(rows[index + 1]) });
  });
  const actions = Array.from(doc.querySelectorAll('a')).filter(el =>
    !el.closest('#category-list, #latest-product-list, #user')
  ).map(el => ({ label: text(el), url: safeUrl(el.getAttribute('href')) }))
    .filter(action => action.url && ['编辑', '保存并分享'].includes(action.label));

  return {
    username: text(user.querySelector('p')),
    avatar: safeUrl(user.querySelector('img')?.getAttribute('src'), true),
    stats,
    recent: Array.from(doc.querySelectorAll('#latest-product-list > div')).map(item).filter(row => row.name),
    categories: Array.from(categories.querySelectorAll('.category-item')).map(category => ({
      name: text(category.querySelector(':scope > p')),
      items: Array.from(category.querySelectorAll(':scope > div')).map(item).filter(row => row.name),
    })).filter(category => category.items.length),
    actions,
  };
}
