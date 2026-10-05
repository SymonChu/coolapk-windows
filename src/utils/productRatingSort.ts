export interface ProductRatingSortOption {
  label: string;
  url: string;
}

/** 点评页的排序选项由服务端 sortSelectCard.entities 提供。 */
export function productRatingSortOptions(productId: string, response: unknown): ProductRatingSortOption[] {
  const root = response && typeof response === 'object' ? response as Record<string, unknown> : {};
  const rows = Array.isArray(root.data) ? root.data : [];
  const card = rows.find((row) => row?.entityTemplate === 'sortSelectCard');
  const entries: Array<{ title?: unknown; url?: unknown }> = Array.isArray(card?.entities) ? card.entities : [];
  const seen = new Set<string>();
  return entries.flatMap((entry) => {
    if (typeof entry?.url !== 'string' || typeof entry?.title !== 'string') return [];
    const label = entry.title.trim();
    const url = entry.url.trim();
    try {
      const outer = new URL(url, 'https://www.coolapk.com');
      const inner = new URL(outer.searchParams.get('url') || '', 'https://www.coolapk.com');
      if (outer.pathname !== '/page' || inner.pathname !== '/product/feedList'
        || inner.searchParams.get('id') !== productId || !inner.searchParams.get('type')
        || !label || seen.has(url)) return [];
      seen.add(url);
      return [{ label, url }];
    } catch {
      return [];
    }
  });
}

export function productRatingRows(response: unknown): Record<string, unknown>[] {
  const root = response && typeof response === 'object' ? response as Record<string, unknown> : {};
  const rows = Array.isArray(root.data) ? root.data : [];
  return rows.flatMap((row) => Array.isArray(row?.entities) ? row.entities : [row])
    .filter((row): row is Record<string, unknown> => row && typeof row === 'object'
      && row.entityType === 'feed');
}
