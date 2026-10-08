import { describe, expect, it } from 'vitest';
// 用 Vite 的 ?raw 读源码：项目 tsconfig 的 lib 只有 ESNext + DOM（无 @types/node），
// 用 node:fs 会报类型错。vitest 走 Vite 管线，?raw 可用（同 HomeTabPanel.doubleColumn.test.ts）。
import dyhPage from '../DyhPage.vue?raw';
import favoritesPage from '../FavoritesPage.vue?raw';
import followingPage from '../FollowingPage.vue?raw';
import headlinePage from '../HeadlinePage.vue?raw';
import productPage from '../ProductPage.vue?raw';
import topicPage from '../TopicPage.vue?raw';

/**
 * 2026-10-08：这 6 个页面挂在 .is-double-column 上，但各自的 scoped 样式原先无条件写
 * `display:flex; flex-direction:column`。构建产物里 scoped 规则排在全局
 * `.feed-list.is-double-column{display:block;column-count:2}` 之后、权重相同（都是 0,2,0），
 * 于是双列被顶掉 ⇒ 选「双列」也还是单列（真实 Chromium 渲染已复现）。
 *
 * 这里把「单列样式必须带 :not(.is-double-column)」钉死，防止以后有人把它改回裸 `.feed-list {`。
 * 注意：ReviewPage 不在此列 —— 它的 `.feed-list` 是自己的两列 grid，不跟全局开关走，属已知另案。
 */
const PAGES: Array<[string, string]> = [
  ['DyhPage', dyhPage],
  ['FavoritesPage', favoritesPage],
  ['FollowingPage', followingPage],
  ['HeadlinePage', headlinePage],
  ['ProductPage', productPage],
  ['TopicPage', topicPage],
];

describe('全站信息流双列：页面样式不能再把全局双列顶掉', () => {
  it.each(PAGES)('%s 的单列列表样式带 :not(.is-double-column)', (_name, source) => {
    expect(source).toContain('is-double-column');
    expect(source).toMatch(/\.feed-list:not\(\.is-double-column\)\s*\{/);
    // 反例钉死：不允许再出现裸 `.feed-list { ... display: flex ... }` 这类会覆盖 column-count 的写法
    expect(source).not.toMatch(/\.feed-list\s*\{[^}]*display:\s*flex/);
  });
});
