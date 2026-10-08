import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const routerMock = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  currentRoute: { value: { path: '/' } },
}));

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>();
  return {
    ...actual,
    useRoute: () => ({ path: '/' }),
    useRouter: () => routerMock,
  };
});

// 2026-10-07（界面稿 v4）：左下角动作区（通知/私信/账号/发布）已迁出——
// 通知/私信/账号回顶栏右侧，发布改为首页悬浮按钮，因此这里不再 mock 动作区组件。

import MainSidebar from '../MainSidebar.vue';
import { useSettingsStore } from '../../../stores/settings';
import { useAuthStore } from '../../../stores/auth';
import * as routeTransition from '../../../utils/routeTransition';
import {
  HOME_TAB_REFRESH_EVENT,
  HOME_TAB_SCROLL_TOP_EVENT,
  resetHomeTabClickState,
} from '../../../utils/homeTab';

const RouterLinkStub = {
  props: ['to'],
  template: '<a :href="to" class="nav-item"><slot /></a>',
};

describe('MainSidebar', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    routerMock.currentRoute.value.path = '/';
    resetHomeTabClickState();
  });

  it('点击导航项时触发 triggerSidebarTransition', async () => {
    const spy = vi.spyOn(routeTransition, 'triggerSidebarTransition');
    const wrapper = mount(MainSidebar, {
      global: {
        stubs: {
          'router-link': RouterLinkStub,
        },
      },
    });

    const homeLink = wrapper.find('a[href="/"]');
    expect(homeLink.exists()).toBe(true);

    await homeLink.trigger('click');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  // 2026-10-06：底部「反馈」「更新」两个按钮已移除，入口统一收敛到设置 → 关于。
  it('底部不再提供反馈与更新按钮（入口已迁到设置 → 关于）', () => {
    const wrapper = mount(MainSidebar, {
      global: {
        stubs: {
          'router-link': RouterLinkStub,
        },
      },
    });

    expect(wrapper.find('.feedback-btn').exists()).toBe(false);
    expect(wrapper.find('.check-update-btn').exists()).toBe(false);
  });

  it('左下角只有个人中心卡片与常显账号菜单（通知/私信/账号/发布已迁出）', () => {
    const wrapper = mount(MainSidebar, {
      global: {
        stubs: {
          'router-link': RouterLinkStub,
        },
      },
    });

    const footer = wrapper.find('.sidebar-footer');
    expect(footer.exists()).toBe(true);
    expect(footer.find('.me-card').exists()).toBe(true);
    // 2026-10-08：卡片下面多了一直显示的账号菜单（四页）
    expect(footer.findAll('.me-menu-item').length).toBe(4);
    // 动作区已迁出：左下角不再有发布按钮/通知/私信/账号浮层入口
    expect(footer.find('.publish-big-btn').exists()).toBe(false);
    expect(footer.find('.notification-wrapper').exists()).toBe(false);
    expect(footer.find('.message-wrapper').exists()).toBe(false);
    expect(footer.find('.user-profile-trigger').exists()).toBe(false);
  });

  // 参考稿：左下角个人中心卡片需要同时展示 头像 / 名字 / 等级 / 经验数值 / 签名 / 获赞·关注·粉丝。
  it('左下角个人中心卡片展示名字、等级、经验数值、签名与获赞关注粉丝', () => {
    const auth = useAuthStore();
    auth.isLoggedIn = true;
    auth.user = {
      uid: '1234567',
      username: '工程师股民',
      userAvatar: '',
      level: 4,
      bio: '不会画图的股民不是一个好股民',
      likenum: 1062,
      follow: 13,
      fans: 191,
      exp: 63254,
      maxExp: 64000
    };

    const wrapper = mount(MainSidebar, {
      global: { stubs: { 'router-link': RouterLinkStub } },
    });

    const card = wrapper.find('.me-card');
    expect(card.find('.me-name').text()).toBe('工程师股民');
    expect(card.find('.me-level-badge').text()).toBe('Lv.4');
    expect(card.find('.me-exp-num').text()).toBe('63254/64000');
    expect(card.find('.me-bio-text').text()).toBe('不会画图的股民不是一个好股民');

    const stats = card.find('.me-stats');
    expect(stats.exists()).toBe(true);
    expect(stats.findAll('.me-stat').length).toBe(3);
    const statsText = stats.text();
    expect(statsText).toContain('1062');
    expect(statsText).toContain('获赞');
    expect(statsText).toContain('13');
    expect(statsText).toContain('关注');
    expect(statsText).toContain('191');
    expect(statsText).toContain('粉丝');

    wrapper.unmount();
  });

  it('应用和下载不再作为左侧独立入口展示', () => {
    const wrapper = mount(MainSidebar, {
      global: {
        stubs: {
          'router-link': RouterLinkStub,
        },
      },
    });

    expect(wrapper.find('a[href="/apps"]').exists()).toBe(false);
    expect(wrapper.find('a[href="/downloads"]').exists()).toBe(false);
    expect(wrapper.find('a[href="/more"]').exists()).toBe(true);
  });

  it('底部不再提供测试版渠道快捷开关（渠道切换统一收进设置页）', () => {
    const settings = useSettingsStore();
    settings.settings.updateChannel = 'stable';
    settings.settings.experimentalFeatures = false;
    const wrapper = mount(MainSidebar, {
      global: { stubs: { 'router-link': RouterLinkStub } },
    });
    expect(wrapper.find('.beta-toggle-btn').exists()).toBe(false);
    wrapper.unmount();
  });

  // 2026-10-06：侧栏右缘的小圆形手柄已删除，折叠统一走左下角动作区的按钮与快捷键。
  it('侧栏右缘不再有小圆形折叠手柄', () => {
    const wrapper = mount(MainSidebar, {
      global: {
        stubs: {
          'router-link': RouterLinkStub,
        },
      },
    });

    expect(wrapper.find('.sidebar-floating-toggle-btn').exists()).toBe(false);
    expect(wrapper.find('.dock-toggle-icon').exists()).toBe(false);
    expect(wrapper.find('a[href="/"]').exists()).toBe(true);
  });

  it('已在首页时单击「首页」回到顶部，不重复导航', async () => {
    const scrollTopSpy = vi.fn();
    window.addEventListener(HOME_TAB_SCROLL_TOP_EVENT, scrollTopSpy);
    const wrapper = mount(MainSidebar, {
      global: { stubs: { 'router-link': RouterLinkStub } },
    });

    await wrapper.find('a[href="/"]').trigger('click');

    expect(scrollTopSpy).toHaveBeenCalledTimes(1);
    expect(routerMock.push).not.toHaveBeenCalled();
    window.removeEventListener(HOME_TAB_SCROLL_TOP_EVENT, scrollTopSpy);
  });

  it('已在首页时双击「首页」回到顶部并刷新当前栏目', async () => {
    const refreshSpy = vi.fn();
    window.addEventListener(HOME_TAB_REFRESH_EVENT, refreshSpy);
    const wrapper = mount(MainSidebar, {
      global: { stubs: { 'router-link': RouterLinkStub } },
    });

    const homeLink = wrapper.find('a[href="/"]');
    await homeLink.trigger('click');
    await homeLink.trigger('click');

    expect(refreshSpy).toHaveBeenCalledTimes(1);
    window.removeEventListener(HOME_TAB_REFRESH_EVENT, refreshSpy);
  });

  // 2026-10-08：左栏那行独立的「设置」并进左下角个人卡的常显菜单（「应用设置」），
  // 导航里不再保留第二个设置入口。
  it('左栏导航里不再有独立的「设置」项', () => {
    const wrapper = mount(MainSidebar, {
      global: { stubs: { 'router-link': RouterLinkStub } },
    });

    expect(wrapper.find('.sidebar-nav a[href="/settings"]').exists()).toBe(false);
    const navLabels = wrapper.findAll('.sidebar-nav .nav-label').map((label) => label.text());
    expect(navLabels).not.toContain('设置');
  });

  it('左下角账号菜单四项：个人主页 / 我的收藏 / 浏览历史 / 应用设置', () => {
    const wrapper = mount(MainSidebar, {
      global: { stubs: { 'router-link': RouterLinkStub } },
    });

    const labels = wrapper.findAll('.me-menu-item .me-menu-label').map((item) => item.text());
    expect(labels).toEqual(['个人主页', '我的收藏', '浏览历史', '应用设置']);
    const titles = wrapper.findAll('.me-menu-item').map((item) => item.attributes('title'));
    expect(titles).toEqual(['个人主页', '我的收藏', '浏览历史', '应用设置']);
  });

  it('未登录：点前两项弹登录窗，「应用设置」照旧直接进设置页', async () => {
    const auth = useAuthStore();
    auth.isLoggedIn = false;
    const wrapper = mount(MainSidebar, {
      global: { stubs: { 'router-link': RouterLinkStub } },
    });

    const items = wrapper.findAll('.me-menu-item');
    await items[0].trigger('click');
    expect(auth.isLoginModalOpen).toBe(true);
    expect(routerMock.push).not.toHaveBeenCalled();

    await items[3].trigger('click');
    expect(routerMock.push).toHaveBeenCalledWith('/settings');
  });

  it('已登录：三项个人入口按顺序跳路由', async () => {
    const auth = useAuthStore();
    auth.isLoggedIn = true;
    const wrapper = mount(MainSidebar, {
      global: { stubs: { 'router-link': RouterLinkStub } },
    });

    const items = wrapper.findAll('.me-menu-item');
    for (const item of items.slice(0, 3)) await item.trigger('click');
    expect(routerMock.push.mock.calls.map((call) => call[0])).toEqual(['/user/me', '/favorites', '/history']);
  });
});
