import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ push: vi.fn(), profile: vi.fn(), qr: vi.fn() }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('../../api/coolapk', () => ({ CoolapkTauriAPI: { getMyProfile: mocks.profile, getUserQrImage: mocks.qr } }));
import MyProfilePage from '../MyProfilePage.vue';
import { useAuthStore } from '../../stores/auth';
import { useSettingsStore } from '../../stores/settings';
function render() { return mount(MyProfilePage, { global: { stubs: { AppDialog: true, MyProfileCards: true } } }); }
describe('移动端个人中心', () => {
  beforeEach(() => {
    localStorage.clear(); setActivePinia(createPinia()); vi.clearAllMocks();
    mocks.profile.mockResolvedValue({ data: { feed: 7, follow: 2, fans: 3, level: 1, experience: 412, next_level_experience: 1000 } });
  });
  it('未登录时私人入口打开登录，更多仍可访问', async () => {
    const wrapper = render();
    await wrapper.find('.identity-link').trigger('click');
    expect(useAuthStore().isLoginModalOpen).toBe(true);
    expect(mocks.push).not.toHaveBeenCalled();
    const more = wrapper.findAll('.profile-menu button').find(button => button.text() === '更多')!;
    await more.trigger('click'); expect(mocks.push).toHaveBeenCalledWith('/more');
    expect(mocks.profile).not.toHaveBeenCalled(); wrapper.unmount();
  });
  it('使用真实资料统计和等级进度，个人主页与关注正确跳转', async () => {
    useAuthStore().user = { uid: '123', username: '测试', userAvatar: '' };
    const wrapper = render(); await flushPromises();
    expect(wrapper.find('.profile-statistics').text()).toContain('7');
    expect(wrapper.find('.level-info').text()).toContain('412/1000');
    await wrapper.find('.identity-link').trigger('click'); expect(mocks.push).toHaveBeenCalledWith('/user/123');
    await wrapper.findAll('.profile-statistics button')[1]!.trigger('click');
    expect(mocks.push).toHaveBeenCalledWith('/user/123/relations/follow'); wrapper.unmount();
  });
  it('缺失动态数量显示未知，不虚构为零', async () => {
    useAuthStore().user = { uid: '123', username: '测试', userAvatar: '' };
    mocks.profile.mockRejectedValue(new Error('offline'));
    const wrapper = render(); await flushPromises();
    expect(wrapper.find('.profile-statistics strong').text()).toBe('—'); wrapper.unmount();
  });
  it('夜间模式按钮切换共享主题', async () => {
    const settings = useSettingsStore(); settings.setTheme('light');
    const wrapper = render();
    const theme = wrapper.findAll('.profile-menu button')[3]!;
    await theme.trigger('click'); expect(settings.settings.theme).toBe('dark');
    await theme.trigger('click'); expect(settings.settings.theme).toBe('light'); wrapper.unmount();
  });
});
