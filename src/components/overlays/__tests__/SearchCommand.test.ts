import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getHotSearches: vi.fn(), push: vi.fn() }));

vi.mock('../../../api/coolapk', () => ({
  CoolapkTauriAPI: { getHotSearches: mocks.getHotSearches },
}));
vi.mock('../../../utils/androidBackButton', () => ({ useAndroidBackButton: vi.fn() }));
// 只替换 useRouter，其余导出保持真实实现
vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>();
  return { ...actual, useRouter: () => ({ push: mocks.push }) };
});

import SearchCommand from '../SearchCommand.vue';
import { useAppStore } from '../../../stores/app';

/**
 * 2026-10-08：右栏的「大家都在搜」卡片被去掉，同一批热门词改为只在
 * 点搜索框弹出的搜索页里展示。这里把「搜索页里确实有这批词」钉住 ——
 * 它是那张卡被删之后热词唯一的落点。
 */
describe('搜索框弹出的搜索页', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    document.body.innerHTML = '';
    mocks.push.mockClear();
    mocks.getHotSearches.mockReset().mockResolvedValue({
      code: 200,
      data: [{ title: '新机资讯' }, { title: '游戏新鲜事' }, { title: '假期随手拍' }],
    });
  });

  it('打开搜索时铺出「热门搜索」词（替代原右栏卡片）', async () => {
    const app = useAppStore();
    const wrapper = mount(SearchCommand, { attachTo: document.body });

    app.openSearch();
    await flushPromises();

    expect(mocks.getHotSearches).toHaveBeenCalled();
    expect(document.body.textContent).toContain('热门搜索');
    const tags = Array.from(document.querySelectorAll('.suggest-tag')).map((el) => el.textContent?.trim());
    expect(tags).toEqual(['新机资讯', '游戏新鲜事', '假期随手拍']);

    wrapper.unmount();
  });

  it('点热词把词填进搜索框（随后走正常搜索流程）', async () => {
    const app = useAppStore();
    const wrapper = mount(SearchCommand, { attachTo: document.body });
    app.openSearch();
    await flushPromises();

    const tags = document.querySelectorAll<HTMLElement>('.suggest-tag');
    tags[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();

    // applySearch 只填词、不直接跳转（跳转由搜索请求/回车完成）
    expect(document.querySelector<HTMLInputElement>('.search-input')?.value).toBe('游戏新鲜事');
    wrapper.unmount();
  });
});
