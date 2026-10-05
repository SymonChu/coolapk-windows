import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const routerMock = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  currentRoute: { value: { path: '/' } },
}));

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>();
  return {
    ...actual,
    useRoute: () => routerMock.currentRoute.value,
    useRouter: () => routerMock,
  };
});

import MobileBottomNav from '../MobileBottomNav.vue';
import { useAuthStore } from '../../../stores/auth';
import {
  HOME_TAB_REFRESH_EVENT,
  HOME_TAB_SCROLL_TOP_EVENT,
  resetHomeTabClickState,
} from '../../../utils/homeTab';

function mountNav() {
  return mount(MobileBottomNav);
}

function navButton(wrapper: ReturnType<typeof mountNav>, label: string) {
  const button = wrapper.findAll('.mobile-nav-item').find((item) => item.text().includes(label));
  if (!button) throw new Error(`未找到底栏按钮：${label}`);
  return button;
}

describe('MobileBottomNav 首页手势', () => {
  const scrollTopSpy = vi.fn();
  const refreshSpy = vi.fn();

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    routerMock.currentRoute.value.path = '/';
    resetHomeTabClickState();
    window.addEventListener(HOME_TAB_SCROLL_TOP_EVENT, scrollTopSpy);
    window.addEventListener(HOME_TAB_REFRESH_EVENT, refreshSpy);
  });

  afterEach(() => {
    window.removeEventListener(HOME_TAB_SCROLL_TOP_EVENT, scrollTopSpy);
    window.removeEventListener(HOME_TAB_REFRESH_EVENT, refreshSpy);
    resetHomeTabClickState();
  });

  it('已在首页时单击「首页」回到顶部，不发起重复导航', async () => {
    const wrapper = mountNav();
    await navButton(wrapper, '首页').trigger('click');

    expect(scrollTopSpy).toHaveBeenCalledTimes(1);
    expect(refreshSpy).not.toHaveBeenCalled();
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it('已在首页时双击「首页」回到顶部并刷新当前栏目', async () => {
    const wrapper = mountNav();
    const home = navButton(wrapper, '首页');

    await home.trigger('click');
    await home.trigger('click');

    expect(scrollTopSpy).toHaveBeenCalledTimes(2);
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it('不在首页时单击「首页」跳回首页，不派发首页事件', async () => {
    routerMock.currentRoute.value.path = '/digital';
    const wrapper = mountNav();
    await navButton(wrapper, '首页').trigger('click');

    expect(routerMock.push).toHaveBeenCalledWith('/');
    expect(scrollTopSpy).not.toHaveBeenCalled();
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('其他底栏按钮只负责导航，不触发首页手势', async () => {
    const wrapper = mountNav();
    await navButton(wrapper, '发现').trigger('click');

    expect(routerMock.push).toHaveBeenCalledWith('/discover');
    expect(scrollTopSpy).not.toHaveBeenCalled();
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('登录前后「我的」均进入个人中心，只有个人中心高亮', async () => {
    const anonymous = mountNav();
    await navButton(anonymous, '我的').trigger('click');
    expect(routerMock.push).toHaveBeenLastCalledWith('/me');
    useAuthStore().user = { uid: '12345', username: '自己' } as never;
    await navButton(mountNav(), '我的').trigger('click');
    expect(routerMock.push).toHaveBeenLastCalledWith('/me');
    routerMock.currentRoute.value.path = '/me';
    expect(navButton(mountNav(), '我的').classes()).toContain('active');
    routerMock.currentRoute.value.path = '/user/12345';
    expect(navButton(mountNav(), '我的').classes()).not.toContain('active');
    routerMock.currentRoute.value.path = '/user/99999';
    expect(navButton(mountNav(), '我的').classes()).not.toContain('active');
  });

  it('未登录时访问任何用户主页都不高亮「我的」', async () => {
    routerMock.currentRoute.value.path = '/user/99999';

    const wrapper = mountNav();
    const profileButton = wrapper.findAll('.mobile-nav-item').find((item) => item.text().includes('我的'));

    // 「我的」统一指向 /me，不会误命中 /user/ 路径。
    expect(profileButton?.classes()).not.toContain('active');
  });
});
