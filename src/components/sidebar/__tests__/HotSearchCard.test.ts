import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getHotSearches: vi.fn(), push: vi.fn() }));

vi.mock('../../../api/coolapk', () => ({
  CoolapkTauriAPI: { getHotSearches: mocks.getHotSearches },
}));

// 只替换 useRouter，其余导出保持真实实现（否则 router/index.ts 里的 createRouter 会变成 undefined）
vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>();
  return { ...actual, useRouter: () => ({ push: mocks.push }) };
});

import HotSearchCard from '../HotSearchCard.vue';

describe('右栏「大家都在搜」', () => {
  beforeEach(() => {
    mocks.getHotSearches.mockReset().mockResolvedValue({
      code: 200,
      data: [{ title: '新机资讯' }, { title: '游戏新鲜事' }, { title: '假期随手拍' }],
    });
    mocks.push.mockClear();
  });

  it('把热搜词渲染成带名次的条目', async () => {
    const wrapper = mount(HotSearchCard);
    await flushPromises();
    expect(wrapper.findAll('.hot-item')).toHaveLength(3);
    expect(wrapper.text()).toContain('新机资讯');
    expect(wrapper.findAll('.hot-rank')[0].text()).toBe('1');
  });

  it('只有第一条带「热」标', async () => {
    const wrapper = mount(HotSearchCard);
    await flushPromises();
    expect(wrapper.findAll('.hot-badge')).toHaveLength(1);
  });

  it('点词条跳搜索页并带上关键词', async () => {
    const wrapper = mount(HotSearchCard);
    await flushPromises();
    await wrapper.findAll('.hot-item')[1].trigger('click');
    expect(mocks.push).toHaveBeenCalledWith({ path: '/search', query: { q: '游戏新鲜事' } });
  });

  it('接口失败时是空态，不抛错', async () => {
    mocks.getHotSearches.mockRejectedValue(new Error('boom'));
    const wrapper = mount(HotSearchCard);
    await flushPromises();
    expect(wrapper.findAll('.hot-item')).toHaveLength(0);
    expect(wrapper.find('.empty-wrapper').exists()).toBe(true);
  });
});
