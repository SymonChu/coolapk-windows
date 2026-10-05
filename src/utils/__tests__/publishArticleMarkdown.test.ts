import { describe, expect, it } from 'vitest';
import { renderPublishArticlePreview } from '../publishArticleMarkdown';

function renderBody(text: string): string {
  return renderPublishArticlePreview({
    title: '',
    cover: null,
    blocks: [{ id: 'body', type: 'text', text }],
  });
}

describe('official article Markdown preview parser', () => {
  it('reuses the existing app emoji renderer and mappings', () => {
    const html = renderBody('[笑哭] [牛牛点赞] [点赞] [不在映射中的表情]');

    expect(html).toContain('title="笑哭"');
    expect(html).toContain('title="牛牛点赞"');
    expect(html).toContain('title="点赞"');
    expect(html).toContain('[不在映射中的表情]');
    expect(html.match(/class="coolapk-emoji"/g)).toHaveLength(3);
  });

  it('applies the official normalization order and Markdown patterns', () => {
    const html = renderBody('A<!--break-->&amp;lt;<br />\n\n\n# 一级\n## 二级\n### 三级\n#### 普通\n**加粗** 【括号强调】 *斜体*');

    expect(html).toContain('A&lt;');
    expect(html).toContain('<span class="article-preview-heading article-preview-heading-1">一级</span>');
    expect(html).toContain('<span class="article-preview-heading article-preview-heading-2">二级</span>');
    expect(html).toContain('<span class="article-preview-heading article-preview-heading-3">三级</span>');
    expect(html).toContain('#### 普通');
    expect(html).toContain('<strong>加粗</strong>');
    expect(html).toContain('<strong>【括号强调】</strong>');
    expect(html).toContain('*斜体*');
    expect(html).not.toContain('<!--break-->');
  });

  it('keeps anchor text opaque to later Markdown parsers, like f.m46250', () => {
    const html = renderBody('<a href="https://example.test">**链接文字** [笑哭]</a>');

    expect(html).toContain('<a href="https://example.test" target="_blank" rel="noopener noreferrer">**链接文字** [笑哭]</a>');
    expect(html).not.toContain('<strong>链接文字</strong>');
    expect(html).not.toContain('class="coolapk-emoji"');
  });

  it('normalizes legacy QQ emoji and adjacent forward-picture anchors before parsing links', () => {
    const html = renderBody(
      '<img src="http://static.coolapk.com/emoticons/default/1.gif" alt="笑哭"/> ' +
      '<a class="feed-forward-pic old" href="https://example.test/1">查看图片</a> ' +
      '<a class="feed-forward-pic old" href="https://example.test/2">查看图片</a>',
    );

    expect(html).toContain('title="笑哭"');
    expect(html).toContain('href="https://example.test/1,https://example.test/2"');
    expect(html).toContain('>查看图片(2)</a>');
  });
});
