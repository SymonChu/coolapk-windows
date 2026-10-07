import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import SidebarEdgeGrip from '../SidebarEdgeGrip.vue';
import { useSettingsStore } from '../../../stores/settings';

// 路由桩：右栏手柄只在首页（path === '/'）显示
const push = vi.fn();
vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/', params: {}, query: {} }),
  useRouter: () => ({ push }),
}));

describe('SidebarEdgeGrip（侧栏边缘悬停手柄）', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('左手柄默认渲染且处于显示态时箭头指向隐藏方向', () => {
    const wrapper = mount(SidebarEdgeGrip, { props: { side: 'left' } });
    expect(wrapper.find('.sidebar-edge-grip.is-left').exists()).toBe(true);
    expect(wrapper.find('.sidebar-edge-grip').classes()).not.toContain('is-hidden-state');
  });

  it('点击左手柄切换左栏折叠状态（同一开关，与原按钮一致）', async () => {
    const settings = useSettingsStore();
    const before = settings.settings.sidebarCollapsed;
    const wrapper = mount(SidebarEdgeGrip, { props: { side: 'left' } });
    await wrapper.find('.sidebar-edge-grip').trigger('click');
    expect(settings.settings.sidebarCollapsed).toBe(!before);
    await wrapper.find('.sidebar-edge-grip').trigger('click');
    expect(settings.settings.sidebarCollapsed).toBe(before);
  });

  it('左栏隐藏后手柄进入 is-hidden-state（常显，提供还原入口）', async () => {
    const settings = useSettingsStore();
    settings.settings.sidebarCollapsed = true;
    const wrapper = mount(SidebarEdgeGrip, { props: { side: 'left' } });
    await flushPromises();
    expect(wrapper.find('.sidebar-edge-grip').classes()).toContain('is-hidden-state');
  });

  it('点击左手柄隐藏后再次点击还原', async () => {
    const settings = useSettingsStore();
    const wrapper = mount(SidebarEdgeGrip, { props: { side: 'left' } });
    await wrapper.find('.sidebar-edge-grip').trigger('click');
    expect(settings.settings.sidebarCollapsed).toBe(true);
    await wrapper.find('.sidebar-edge-grip').trigger('click');
    expect(settings.settings.sidebarCollapsed).toBe(false);
  });

  it('点击右手柄切换右栏显隐（toggleHomeRightSidebar）', async () => {
    const settings = useSettingsStore();
    const before = settings.settings.hideHomeRightSidebar;
    const wrapper = mount(SidebarEdgeGrip, { props: { side: 'right' } });
    await wrapper.find('.sidebar-edge-grip').trigger('click');
    expect(settings.settings.hideHomeRightSidebar).toBe(!before);
  });
});
