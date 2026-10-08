import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import RightSidebar from '../RightSidebar.vue';
import { useSettingsStore } from '../../../stores/settings';

// 只钉卡片顺序/组成：卡片全部用同名桩替换，避免各自发接口请求。
const cardStubs = {
  FollowedTopicsCard: { template: '<div class="card-followed-topics" />' },
  WelcomeCard: { template: '<div class="card-welcome" />' },
  TrendingList: { template: '<div class="card-trending" />' },
  HotTopicList: { template: '<div class="card-hot-topics" />' },
};

const EXPECTED_ORDER = [
  'card-followed-topics',
  'card-welcome',
  'card-trending',
  'card-hot-topics',
];

function mountRail() {
  return mount(RightSidebar, { global: { stubs: cardStubs } });
}

describe('首页右栏卡片', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useSettingsStore().settings.hideHomeRightSidebar = false;
  });

  // 2026-10-08 用户要求：「我关注的话题」提到右栏最上面。
  it('「我关注的话题」排在最上面，欢迎卡退到它下面', () => {
    const wrapper = mountRail();
    const html = wrapper.find('.right-sidebar').html();

    const positions = EXPECTED_ORDER.map((cls) => html.indexOf(cls));
    positions.forEach((position) => expect(position).toBeGreaterThanOrEqual(0));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(html.indexOf('card-followed-topics')).toBeLessThan(html.indexOf('card-welcome'));
  });

  /**
   * 2026-10-08：用户要求去掉右栏的「大家都在搜」，同一批热门词只在点搜索框弹出的
   * 搜索页里展示（SearchCommand 的「热门搜索」区）。这条把「右栏不再有它」钉住，
   * 免得以后有人把卡片加回来。
   */
  it('右栏不再有「大家都在搜」卡片，其它四张卡片都在', () => {
    const wrapper = mountRail();
    const rail = wrapper.find('.right-sidebar');
    const html = rail.html();

    // 注意用 text()：模板里那段说明改动原因的注释也会出现在 html() 里
    expect(rail.text()).not.toContain('大家都在搜');
    expect(rail.text()).not.toContain('热门搜索');
    expect(html).not.toContain('card-hot-search');
    expect(rail.element.children.length).toBe(EXPECTED_ORDER.length);
  });

  it('顶栏「隐藏右栏」开关仍然优先于各卡片自己的显示设置', () => {
    useSettingsStore().settings.hideHomeRightSidebar = true;
    expect(mountRail().find('.right-sidebar').exists()).toBe(false);
  });
});
