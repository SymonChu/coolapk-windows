import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent, nextTick, onMounted } from 'vue';

const routeState = vi.hoisted(() => ({ value: null as any }));

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>();
  const { reactive } = await import('vue');
  routeState.value = reactive({ path: '/', fullPath: '/' });
  return {
    ...actual,
    useRoute: () => routeState.value,
    useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  };
});

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => false,
  invoke: vi.fn(),
}));

import AppShell from '../AppShell.vue';
import { useSettingsStore } from '../../../stores/settings';

const TopBarStub = { template: '<div class="top-bar-stub" />' };
const MainSidebarStub = { template: '<div class="main-sidebar-stub" />' };
const PageTabBarStub = { template: '<div class="page-tab-bar-stub" />' };
const NetworkStatusBannerStub = { template: '<div class="network-status-banner-stub" />' };
const MobileTopBarStub = { template: '<div class="mobile-top-bar-stub" />' };
const MobileBottomNavStub = { template: '<div class="mobile-bottom-nav-stub" />' };

describe('AppShell', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    Object.assign(routeState.value, { path: '/', fullPath: '/' });
  });

  it.each(['/digital', '/discover', '/me', '/messages', '/feed/123', '/settings/appearance', '/favorites', '/user/123', '/search'])('%s 切换布局保留路由内容实例、输入和滚动状态', async path => {
    Object.assign(routeState.value, { path, fullPath: path });
    const load = vi.fn();
    const Page = defineComponent({ setup() { onMounted(load); }, template: '<div class="page-state"><input value="未发送的内容" /></div>' });
    const wrapper = mount(AppShell, {
      slots: { default: Page },
      global: { stubs: { TopBar: TopBarStub, MainSidebar: MainSidebarStub, PageTabBar: PageTabBarStub,
        NetworkStatusBanner: NetworkStatusBannerStub, MobileTopBar: MobileTopBarStub, MobileBottomNav: MobileBottomNavStub } },
    });
    const original = wrapper.find('.page-state').element;
    original.scrollTop = 320;
    const settings = useSettingsStore();
    for (const disabled of [true, false, true, false]) {
      settings.settings.disableAutoMobileMode = disabled;
      window.dispatchEvent(new Event('resize'));
      await nextTick();
      expect(wrapper.find('.page-state').element).toBe(original);
      expect(original.scrollTop).toBe(320);
      expect((wrapper.find('input').element as HTMLInputElement).value).toBe('未发送的内容');
      expect(load).toHaveBeenCalledTimes(1);
    }
    wrapper.unmount();
  });

  it('四个主栏目显示底栏，子页面隐藏，返回主栏目恢复', async () => {
    const wrapper = mount(AppShell, {
      global: { stubs: { TopBar: TopBarStub, MainSidebar: MainSidebarStub,
        PageTabBar: PageTabBarStub, NetworkStatusBanner: NetworkStatusBannerStub,
        MobileTopBar: MobileTopBarStub, MobileBottomNav: MobileBottomNavStub } },
    });
    for (const path of ['/digital', '/discover', '/me', '/', '/messages', '/messages?uid=123',
      '/feed/123', '/settings/appearance', '/my-plugins', '/my-plugins/store', '/favorites', '/user/123', '/search']) {
      Object.assign(routeState.value, { path: path.split('?')[0], fullPath: path });
      await nextTick();
      const visible = ['/', '/digital', '/discover', '/me'].includes(path);
      expect(wrapper.findComponent(MobileBottomNavStub).exists(), path).toBe(visible);
      expect(wrapper.classes().includes('has-mobile-bottom-nav'), path).toBe(visible);
    }
    Object.assign(routeState.value, { path: '/me', fullPath: '/me' });
    await nextTick();
    expect(wrapper.findComponent(MobileBottomNavStub).exists()).toBe(true);
    wrapper.unmount();
  });

  it('默认状态下渲染移动端顶栏和底栏，且不包含 prevent-mobile-layout 类名', () => {
    const wrapper = mount(AppShell, {
      global: {
        stubs: {
          TopBar: TopBarStub,
          MainSidebar: MainSidebarStub,
          PageTabBar: PageTabBarStub,
          NetworkStatusBanner: NetworkStatusBannerStub,
          MobileTopBar: MobileTopBarStub,
          MobileBottomNav: MobileBottomNavStub,
        },
      },
    });

    expect(wrapper.classes()).not.toContain('prevent-mobile-layout');
    expect(wrapper.findComponent(MobileTopBarStub).exists()).toBe(true);
    expect(wrapper.findComponent(MobileBottomNavStub).exists()).toBe(true);
  });

  it('开启 disableAutoMobileMode 时隐藏移动端顶栏和底栏，且添加 prevent-mobile-layout 类名', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const settingsStore = useSettingsStore(pinia);
    settingsStore.settings.disableAutoMobileMode = true;

    const wrapper = mount(AppShell, {
      global: {
        plugins: [pinia],
        stubs: {
          TopBar: TopBarStub,
          MainSidebar: MainSidebarStub,
          PageTabBar: PageTabBarStub,
          NetworkStatusBanner: NetworkStatusBannerStub,
          MobileTopBar: MobileTopBarStub,
          MobileBottomNav: MobileBottomNavStub,
        },
      },
    });

    expect(wrapper.classes()).toContain('prevent-mobile-layout');
    expect(wrapper.findComponent(MobileTopBarStub).exists()).toBe(false);
    expect(wrapper.findComponent(MobileBottomNavStub).exists()).toBe(false);
  });
});
