import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { describe, it, expect, vi } from 'vitest';
const state = vi.hoisted(() => ({ route: { path: '/digital', query: { title: '今日热门' }, meta: {} } }));
vi.mock('vue-router', async (importOriginal) => ({ ...await importOriginal<typeof import('vue-router')>(), useRoute: () => state.route, useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../../../stores/app', () => ({ useAppStore: () => ({ openSearch: vi.fn() }) }));
vi.mock('../../../stores/auth', () => ({ useAuthStore: () => ({ user: { userAvatar: 'avatar.png' } }) }));
vi.mock('../../../stores/notifications', () => ({ useNotificationStore: () => ({ unreadCount: 1, notificationCount: 2 }) }));
import MobileTopBar from '../MobileTopBar.vue';
describe('移动数码顶部', () => {
  it('只显示官方的四个入口，数据图标的遮罩保留引号', () => {
    state.route.path = '/digital';
    const wrapper = mount(MobileTopBar, { props: { navigationOpen: false, macOverlay: false }, global: { plugins: [createPinia()], stubs: { AppAvatar: true } } });
    expect(wrapper.findAll('button')).toHaveLength(4);
    expect(wrapper.find('.mobile-top-actions').exists()).toBe(false);
    expect(wrapper.find('.digital-official-icon span').attributes('style')).toContain('url("');
  });
  it('内容列表标题使用跳转时传入的业务名称', () => {
    state.route.path = '/page';
    const wrapper = mount(MobileTopBar, { props: { navigationOpen: false, macOverlay: false }, global: { plugins: [createPinia()] } });
    expect(wrapper.find('.mobile-page-title').text()).toBe('今日热门');
  });
});
