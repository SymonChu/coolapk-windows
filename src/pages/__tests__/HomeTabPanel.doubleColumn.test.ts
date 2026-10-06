import { describe, it, expect } from 'vitest';
// 用 Vite 的 ?raw 导入直接读源码：项目 tsconfig 的 lib 只有 ESNext + DOM（无 @types/node），
// 用 node:fs 会报类型错。vitest 走的是 Vite 管线，?raw 可用。
import homeTabPanel from '../HomeTabPanel.vue?raw';

/**
 * 2026-10-06：双列从「两个各自独立滚动的瀑布流」改成「两列同时滑动」。
 *
 * 用户最初要的是两列各自不干涉，后来明确改为同时滑动。
 * 这里把新结构钉住，避免以后有人「优化」回两列独立滚动：
 * 必须共用外层 .feed-scroll-container 这一个滚动条。
 */
describe('首页双列（同时滑动）', () => {
  it('不再保留两个独立滚动容器的旧结构', () => {
    // 旧的 .feed-columns 包裹层 + 内部 .feed-column 独立滚动容器
    expect(homeTabPanel).not.toMatch(/\.feed-columns\s*\{/);
    expect(homeTabPanel).not.toMatch(/\.feed-column\s*\{/);
    expect(homeTabPanel).not.toContain('handleColumnScroll');
    expect(homeTabPanel).not.toContain('columnEls');
    expect(homeTabPanel).not.toContain('estimateEntryHeight');
  });

  it('整个列表分支只有一处 @scroll（即外层共享滚动容器）', () => {
    const scrollBindings = homeTabPanel.match(/@scroll/g) ?? [];
    expect(scrollBindings).toHaveLength(1);
    // 滚动事件绑在 .feed-scroll-container 上。
    // 注意类名写在 :class 数组里（单引号），不是 class="..." 字面量。
    expect(homeTabPanel).toMatch(/feed-scroll-container[\s\S]{0,300}@scroll=/);
  });

  it('双列用 CSS column-count 瀑布流实现，卡片不跨列断裂', () => {
    // 同一个列表容器上按 isDoubleColumn 切换 class，而不是两套 v-for 分支
    expect(homeTabPanel).toContain("'is-double-column': isDoubleColumn");
    expect(homeTabPanel).toMatch(/\.feed-list-padding\.is-double-column\s*\{[^}]*column-count:\s*2/);
    expect(homeTabPanel).toMatch(/is-double-column[^{]*\{[^}]*break-inside:\s*avoid/);
  });

  it('容器过窄时双列退化为单列，交给外层容器滚动', () => {
    // 退化后列是 overflow:visible，外层必须可滚，否则内容被裁掉且无处可滚
    expect(homeTabPanel).toMatch(/@container layout \(max-width: 560px\)[\s\S]*?column-count:\s*1/);
  });
});
