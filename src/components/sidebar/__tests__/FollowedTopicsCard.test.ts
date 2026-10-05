import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getFollowedTopics: vi.fn() }));

vi.mock('../../../api/coolapk', () => ({ CoolapkTauriAPI: { getFollowedTopics: mocks.getFollowedTopics } }));

import FollowedTopicsCard from '../FollowedTopicsCard.vue';
import { useAuthStore } from '../../../stores/auth';
import { useSettingsStore } from '../../../stores/settings';

const RouterLinkStub = { props: ['to'], template: '<a class="rl"><slot /></a>' };

function mountCard() {
  return mount(FollowedTopicsCard, { global: { stubs: { 'router-link': RouterLinkStub } } });
}

describe('我关注的话题卡片', () => {
  beforeEach(() => {
    mocks.getFollowedTopics.mockReset().mockResolvedValue({ data: [] });
    useAuthStore().isLoggedIn = true;
    useSettingsStore().settings.showHomeFollowedTopics = true;
  });

  it('未登录时不渲染（改由欢迎卡占位）', () => {
    useAuthStore().isLoggedIn = false;
    expect(mountCard().find('.sidebar-card').exists()).toBe(false);
    expect(mocks.getFollowedTopics).not.toHaveBeenCalled();
  });

  it('设置关闭时不渲染', () => {
    useSettingsStore().settings.showHomeFollowedTopics = false;
    expect(mountCard().find('.sidebar-card').exists()).toBe(false);
  });

  it('渲染话题名，并在服务端给出未读字段时显示角标', async () => {
    mocks.getFollowedTopics.mockResolvedValue({
      data: [
        { entityId: 'a', title: '#数码日常', newFeedsCount: 12 },
        { entityId: 'b', title: '假期随手拍' },
      ],
    });
    const wrapper = mountCard();
    await flushPromises();

    expect(mocks.getFollowedTopics).toHaveBeenCalledWith(1);
    const items = wrapper.findAll('.topic-item');
    expect(items).toHaveLength(2);
    expect(items[0].text()).toContain('数码日常');
    expect(items[0].find('.topic-unread').text()).toContain('12');
    // 未读字段缺失时不拿关注数冒充
    expect(items[1].find('.topic-unread').exists()).toBe(false);
  });

  it('标题缺失时从 url 解析话题 tag', async () => {
    mocks.getFollowedTopics.mockResolvedValue({
      data: [{ entityId: 'c', url: 'coolapk://topic/%E5%85%85%E7%94%B5%E5%A4%B4%E5%85%B4%E8%B6%A3%E5%B0%8F%E7%BB%84' }],
    });
    const wrapper = mountCard();
    await flushPromises();

    expect(wrapper.find('.topic-item').text()).toContain('充电头兴趣小组');
  });

  it('没有可用条目时给出空态，但仍保留管理入口', async () => {
    const wrapper = mountCard();
    await flushPromises();

    expect(wrapper.find('.empty-hint').exists()).toBe(true);
    expect(wrapper.find('.manage-entry').exists()).toBe(true);
  });
});
