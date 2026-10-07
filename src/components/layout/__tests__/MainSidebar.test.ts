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

// 2026-10-06：左下角动作区搬成了独立组件，它内部会做通知轮询与任务栏图标同步，
// 单测环境没有 Tauri，会抛未捕获错误，因此这里只验证「有没有被挂上去」。
vi.mock('../SidebarActionBar.vue', () => ({
  default: { name: 'SidebarActionBar', template: '<div class="sidebar-action-bar-stub" />' },
}));

import MainSidebar from '../MainSidebar.vue';
import { useSettingsStore } from '../../../stores/settings';
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

  it('底部为个人中心卡片（界面稿 v3）并挂载左下角动作区', () => {
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
    expect(footer.findComponent({ name: 'SidebarActionBar' }).exists()).toBe(true);
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
});
