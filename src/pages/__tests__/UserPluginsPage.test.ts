import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { reactive } from 'vue';
import UserPluginsPage from '../UserPluginsPage.vue';
import { useAuthStore } from '../../stores/auth';
import { useAppStore } from '../../stores/app';

const api = vi.hoisted(() => ({ getUserPlugins: vi.fn(), saveUserPlugins: vi.fn(), claimUserPlugin: vi.fn(), openUrl: vi.fn() }));
const toast = vi.hoisted(() => vi.fn());
let route: { path: string };
vi.mock('../../api/coolapk', () => ({ CoolapkTauriAPI: api }));
vi.mock('../../utils/toast', () => ({ showToast: toast }));
vi.mock('vue-router', () => ({ useRoute: () => route, useRouter: () => ({ push: vi.fn(), resolve: () => ({ matched: [{}] }) }) }));

const avatar = { id: 8, plugin_type: 0, title: '头像甲', avatar_plugin: 'avatar.png', can_use: 1 };
const feed = { id: 9, plugin_type: 1, title: '动态甲', feed_plugin: 'feed.gif', can_use: 1 };
const initial = { avatarPluginList: [avatar], feedPluginList: [feed], selectedAvatarPluginRow: avatar, selectedFeedPluginRow: feed, avatarPluginUrl: 'avatar.png', feedPluginUrl: 'feed.gif' };
function render() {
  return mount(UserPluginsPage, { global: { stubs: { AppAvatar: true, AppImage: true } } });
}
beforeEach(() => {
  vi.clearAllMocks();
  setActivePinia(createPinia());
  route = reactive({ path: '/my-plugins' });
  const auth = useAuthStore(); auth.isLoggedIn = true; auth.user = { uid: '123', username: '用户', userAvatar: 'user.png' };
  api.getUserPlugins.mockImplementation((_store, page = 1) => Promise.resolve({ data: page === 1 ? initial : { pluginList: [] } }));
  api.saveUserPlugins.mockResolvedValue({ data: { status: 200, message: '已保存' } });
});
describe('挂件管理和商店', () => {
  it('选择只更新预览，明确保存时同时提交两类 ID，卸下不会清空另一类', async () => {
    const wrapper = render(); await flushPromises();
    await wrapper.find('.plugin-choice').trigger('click');
    expect(api.saveUserPlugins).not.toHaveBeenCalled();
    await wrapper.find('.plugin-save button').trigger('click'); await flushPromises();
    expect(api.saveUserPlugins).toHaveBeenCalledWith(0, 9);
    expect(useAuthStore().user?.avatarPluginUrl).toBe('');
    expect(useAuthStore().user?.feedPluginUrl).toBe('feed.gif');
    wrapper.unmount();
  });
  it('保存失败时保留之前生效的装扮', async () => {
    api.saveUserPlugins.mockResolvedValue({ data: { status: 400, message: '不可使用' } });
    const wrapper = render(); await flushPromises();
    await wrapper.find('.plugin-choice').trigger('click');
    await wrapper.find('.plugin-save button').trigger('click'); await flushPromises();
    expect(useAuthStore().user?.avatarPluginUrl).toBe('avatar.png');
    expect(toast).toHaveBeenCalledWith('不可使用', 'error');
    wrapper.unmount();
  });
  it('仅一项且下一页为空时不显示加载更多，头像和动态分别确认', async () => {
    const wrapper = render(); await flushPromises();
    expect(api.getUserPlugins).toHaveBeenCalledWith(false, 2, 0);
    expect(api.getUserPlugins).toHaveBeenCalledWith(false, 2, 1);
    expect(wrapper.find('.pagination button').exists()).toBe(false);
    await wrapper.findAll('[role="tab"]')[1].trigger('click');
    expect(wrapper.find('.pagination button').exists()).toBe(false);
    wrapper.unmount();
  });
  it('确认有下一页后显示按钮，点击复用预读结果，最后一页不留按钮', async () => {
    api.getUserPlugins.mockImplementation((_store, page = 1, type = 0) => Promise.resolve({ data: page === 1 ? initial : { pluginList: page === 2 && type === 0 ? [{ ...avatar, id: 10, title: '头像乙' }] : [] } }));
    const wrapper = render(); await flushPromises();
    expect(wrapper.find('.pagination button').text()).toBe('加载更多');
    expect(wrapper.text()).not.toContain('头像乙');
    await wrapper.find('.pagination button').trigger('click'); await flushPromises();
    expect(wrapper.text()).toContain('头像乙');
    expect(api.getUserPlugins.mock.calls.filter(([, page, type]) => page === 2 && type === 0)).toHaveLength(1);
    expect(api.getUserPlugins).toHaveBeenCalledWith(false, 3, 0);
    expect(wrapper.find('.pagination button').exists()).toBe(false);
    wrapper.unmount();
  });
  it('已佩戴项不在第一页时仍保存原 ID', async () => {
    api.getUserPlugins.mockResolvedValue({ data: { ...initial, feedPluginList: [] } });
    const wrapper = render(); await flushPromises();
    await wrapper.find('.plugin-save button').trigger('click'); await flushPromises();
    expect(api.saveUserPlugins).toHaveBeenCalledWith(8, 9);
    wrapper.unmount();
  });
  it('商店不会自动领取或发布；发帖获取只打开带话题的编辑器', async () => {
    route.path = '/my-plugins/store';
    api.getUserPlugins.mockResolvedValue({ data: { ...initial, pluginList: [{ ...avatar, get_url: 'https://www.coolapk.com/feed/writer?type=feed&targetType=tag&tag=马年大吉' }] } });
    const wrapper = render(); await flushPromises();
    expect(api.claimUserPlugin).not.toHaveBeenCalled();
    expect(useAppStore().isPublishOpen).toBe(false);
    await wrapper.find('.claim-button').trigger('click'); await flushPromises();
    expect(useAppStore().isPublishOpen).toBe(true);
    expect(useAppStore().publishInitialText).toBe('#马年大吉# ');
    expect(api.claimUserPlugin).not.toHaveBeenCalled();
    wrapper.unmount();
  });
  it('直接领取在点击后请求，服务端成功才显示已获取', async () => {
    route.path = '/my-plugins/store';
    api.getUserPlugins.mockResolvedValue({ data: { ...initial, pluginList: [{ ...avatar, get_url: 'https://m.coolapk.com/mp/userPlugin/getPlugin?id=8' }] } });
    api.claimUserPlugin.mockResolvedValue({ data: { status: 200, message: '领取成功' } });
    const wrapper = render(); await flushPromises();
    await wrapper.find('.claim-button').trigger('click'); await flushPromises();
    expect(api.claimUserPlugin).toHaveBeenCalledWith(8);
    expect(wrapper.find('.claim-button').text()).toBe('已获取');
    wrapper.unmount();
  });
  it('退出账号后丢弃在途列表响应', async () => {
    let finish!: (data: any) => void;
    api.getUserPlugins.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const wrapper = render(); await flushPromises();
    useAuthStore().isLoggedIn = false; useAuthStore().user = null; await flushPromises();
    finish({ data: initial }); await flushPromises();
    expect(wrapper.find('.plugin-grid').exists()).toBe(false);
    expect(useAuthStore().user).toBeNull();
    wrapper.unmount();
  });
});
