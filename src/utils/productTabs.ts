export interface ProductTab {
  key: string;
  label: string;
  url: string;
  kind: 'config' | 'rating' | 'feed' | 'external';
  feedType?: string;
  subId?: string;
}

interface ServerProductTab {
  title?: unknown;
  url?: unknown;
  page_name?: unknown;
  is_open?: unknown;
}

/** 产品详情的 tabList 决定官方页面的栏目顺序和可见性。 */
export function productTabs(productId: string, value: unknown): ProductTab[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((item: ServerProductTab, index) => {
    if (!item || String(item.is_open ?? '1') === '0' || typeof item.url !== 'string') return [];
    const label = String(item.title || '').trim();
    if (!label) return [];
    const url = item.url.trim();
    try {
      const outer = new URL(url, 'https://www.coolapk.com');
      const innerValue = outer.pathname === '/page' ? outer.searchParams.get('url') : url;
      const inner = new URL(innerValue || '', 'https://www.coolapk.com');
      const feedType = inner.searchParams.get('type') || '';
      const targetId = inner.searchParams.get('id') || '';
      const pageName = String(item.page_name || '').trim();
      let tab: ProductTab;
      if (inner.pathname === '/product/feedList' && targetId !== productId) return [];
      if (inner.pathname === '/product/feedList' && targetId === productId) {
        if (feedType === 'main') tab = { key: 'config', label, url, kind: 'config' };
        else if (feedType === 'rating') tab = { key: 'rating', label, url, kind: 'rating' };
        else if (feedType === 'subTabFeed') {
          const subId = inner.searchParams.get('subId') || '';
          if (!/^\d+$/.test(subId)) return [];
          tab = { key: `subtab:${subId}`, label, url, kind: 'feed', subId, feedType };
        } else if (feedType) tab = { key: feedType, label, url, kind: 'feed', feedType };
        else return [];
      } else if (url.startsWith('/') && !url.startsWith('//')) {
        tab = { key: `page:${pageName || index}`, label, url, kind: 'external' };
      } else return [];
      if (seen.has(tab.key)) return [];
      seen.add(tab.key);
      return [tab];
    } catch {
      return [];
    }
  });
}
