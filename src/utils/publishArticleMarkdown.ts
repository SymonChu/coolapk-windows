import { renderCoolapkEmoji } from './coolapkEmoji';
import type { PublishArticleState } from './publishArticle';

type ArticleTextPart =
  | { type: 'text'; text: string }
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'bold'; text: string }
  | { type: 'link'; text: string; href: string };

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function safeHref(value: string): string | null {
  const href = value.trim();
  if (/^(https?:\/\/|mailto:)/i.test(href) || href.startsWith('/') || href.startsWith('#/')) return href;
  return null;
}

function safeImageSource(value: string | null | undefined): string | null {
  if (!value) return null;
  const src = value.trim();
  if (/^(https?:\/\/|blob:)/i.test(src) || src.startsWith('/') || src.startsWith('./')) return src;
  if (/^data:image\/(?:png|jpe?g|gif|webp|avif);base64,/i.test(src)) return src;
  return null;
}

function isOfficialBlank(value: string): boolean {
  return value.trim().length === 0;
}

function normalizeOfficialForwardPictureLinks(value: string): string {
  // Exact port of j88.m50824: rewrite the legacy form, merge adjacent forward
  // picture anchors and keep all other text in the same order.
  const normalized = value.replace(
    / \[(查看图片(?:\(\d\))?)]\((.+?)\)/g,
    ' <a class="feed-forward-pic" href="$2">$1</a> ',
  );
  const matcher = /<a class="feed-forward-pic.+?href="(.+?)">查看图片<\/a>/g;
  const sections: Array<{ value: string; isForwardPicture: boolean }> = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(normalized))) {
    const precedingText = normalized.slice(cursor, match.index);
    if (match.index > cursor && !isOfficialBlank(precedingText)) {
      sections.push({ value: precedingText, isForwardPicture: false });
    }
    sections.push({ value: match[1], isForwardPicture: true });
    cursor = match.index + match[0].length;
  }

  if (cursor === 0) return normalized;
  sections.push({ value: normalized.slice(cursor), isForwardPicture: false });

  const merged: typeof sections = [];
  for (const section of sections) {
    const previous = merged[merged.length - 1];
    if (section.isForwardPicture && previous?.isForwardPicture) {
      previous.value += `,${section.value}`;
    } else {
      merged.push({ ...section });
    }
  }

  return merged.map((section) => {
    if (!section.isForwardPicture) return section.value;
    const urls = section.value.split(',').filter((url) => !isOfficialBlank(url));
    const label = `查看图片${urls.length > 1 ? `(${urls.length})` : ''}`;
    return `<a class="feed-forward-pic" href="${urls.join(',')}">${label}</a>`;
  }).join('');
}

function normalizeOfficialArticleText(value: string): string {
  // Keep this replacement order identical to f88.m46422.
  const normalized = value
    .replace(/<!--break-->/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/<br \/>/g, '\n')
    .replace(/<\/?p>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/<img src="http:\/\/static\.coolapk\.com\/emoticons\/default\/\d{1,2}\.gif" alt="(.{1,3})"\/>/g, '[$1]');

  return normalizeOfficialForwardPictureLinks(normalized);
}

function applyOfficialRule(
  parts: ArticleTextPart[],
  pattern: RegExp,
  createPart: (match: RegExpExecArray) => ArticleTextPart[],
): ArticleTextPart[] {
  const next: ArticleTextPart[] = [];
  for (const part of parts) {
    // f.m46250 runs each subsequent parser only on plain zhe text parts.
    if (part.type !== 'text') {
      next.push(part);
      continue;
    }

    const matcher = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
    let cursor = 0;
    let match: RegExpExecArray | null;
    while ((match = matcher.exec(part.text))) {
      if (match.index > cursor) next.push({ type: 'text', text: part.text.slice(cursor, match.index) });
      next.push(...createPart(match));
      cursor = match.index + match[0].length;
      if (!match[0].length) matcher.lastIndex += 1;
    }
    if (cursor < part.text.length) next.push({ type: 'text', text: part.text.slice(cursor) });
  }
  return next;
}

function parseOfficialArticleText(source: string): ArticleTextPart[] {
  let parts: ArticleTextPart[] = [{ type: 'text', text: normalizeOfficialArticleText(source) }];

  // Exact f88.textPartParserListWithMD order through its Markdown rules.
  parts = applyOfficialRule(parts, /<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/g, (match) => [
    { type: 'link', text: match[2] ?? '', href: match[1] ?? '' },
  ]);
  parts = applyOfficialRule(parts, /(?<=^|\n)# ([^#\n]+)(?=\n|$)/g, (match) => [{ type: 'heading', level: 1, text: match[1] }]);
  parts = applyOfficialRule(parts, /(?<=^|\n)## ([^#\n]+)(?=\n|$)/g, (match) => [{ type: 'heading', level: 2, text: match[1] }]);
  parts = applyOfficialRule(parts, /(?<=^|\n)### ([^#\n]+)(?=\n|$)/g, (match) => [{ type: 'heading', level: 3, text: match[1] }]);
  parts = applyOfficialRule(parts, /\*\*(.*?)\*\*/g, (match) => [{ type: 'bold', text: match[1] }]);
  parts = applyOfficialRule(parts, /(【[^】\n]+】)/g, (match) => [{ type: 'bold', text: match[1] }]);
  return parts;
}

function renderOfficialArticleText(source: string): string {
  return parseOfficialArticleText(source).map((part) => {
    if (part.type === 'text') return renderCoolapkEmoji(escapeHtml(part.text));
    if (part.type === 'link') {
      const href = safeHref(part.href);
      return href
        ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(part.text)}</a>`
        : escapeHtml(part.text);
    }
    if (part.type === 'bold') return `<strong>${escapeHtml(part.text)}</strong>`;
    return `<span class="article-preview-heading article-preview-heading-${part.level}">${escapeHtml(part.text)}</span>`;
  }).join('');
}

/** Preview the same simple Markdown parser used by the official article preview (f88/i88). */
export function renderPublishArticlePreview(state: PublishArticleState): string {
  const cover = safeImageSource(state.cover?.preview || state.cover?.url);
  const parts = ['<article class="article-preview-content">'];
  if (cover) parts.push(`<img class="article-preview-cover" src="${escapeHtml(cover)}" alt="">`);
  if (state.title.trim()) parts.push(`<h1 class="article-preview-title">${escapeHtml(state.title.trim())}</h1>`);

  let hasBody = false;
  for (const block of state.blocks) {
    if (block.type === 'text') {
      if (!block.text.trim()) continue;
      hasBody = true;
      parts.push(`<div class="article-preview-markdown">${renderOfficialArticleText(block.text)}</div>`);
      continue;
    }

    if (block.type === 'preserved') {
      hasBody = true;
      parts.push(`<div class="article-preview-preserved">官方内容块（${escapeHtml(String(block.model.type || '未知'))}）</div>`);
      continue;
    }

    const src = safeImageSource(block.image.preview || block.image.url);
    if (!src) continue;
    hasBody = true;
    parts.push(`<img class="article-preview-image" src="${escapeHtml(src)}" alt="正文图片">`);
    const description = block.description?.trim();
    if (description) {
      parts.push(`<div class="article-preview-image-description">${escapeHtml(description)}</div>`);
    }
  }

  if (!hasBody) parts.push('<p class="article-preview-empty">正文预览会显示在这里</p>');
  parts.push('</article>');
  return parts.join('');
}
