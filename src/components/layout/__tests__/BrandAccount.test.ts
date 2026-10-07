import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const routerMock = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>();
  return {
    ...actual,
    useRouter: () => routerMock,
  };
});

// 单测环境没有 Tauri：资料浮层悬停会拉取用户详情，这里直接 mock 掉网络层。
vi.mock('../../../api/coolapk', () => ({
  CoolapkTauriAPI: { getPublicUserSpace: vi.fn().mockResolvedValue({}) },
}));

import BrandAccount from '../BrandAccount.vue';
import { useAuthStore } from '../../../stores/auth';

describe('BrandAccount（顶栏左上角品牌/账号区）', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('未登录显示酷安 logo 与名称，不显示头像', () => {
    const wrapper = mount(BrandAccount);

    expect(wrapper.find('.brand-logo').exists()).toBe(true);
    expect(wrapper.find('.brand-name').text()).toBe('酷安');
    expect(wrapper.find('.brand-avatar').exists()).toBe(false);
    wrapper.unmount();
  });

  it('登录后显示个人头像，不再显示 logo 与名称', () => {
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

    const wrapper = mount(BrandAccount);

    expect(wrapper.find('.brand-avatar').exists()).toBe(true);
    expect(wrapper.find('.brand-logo').exists()).toBe(false);
    expect(wrapper.find('.brand-name').exists()).toBe(false);
    wrapper.unmount();
  });

  it('悬停弹出资料浮层：名字/等级/经验数值/签名/获赞关注粉丝', async () => {
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

    const wrapper = mount(BrandAccount);

    expect(wrapper.find('.user-profile-popover').exists()).toBe(false);
    await wrapper.find('.brand-account').trigger('mouseenter');

    const popover = wrapper.find('.user-profile-popover');
    expect(popover.exists()).toBe(true);
    expect(popover.find('.popover-username').text()).toBe('工程师股民');
    expect(popover.find('.popover-level').text()).toBe('Lv.4');
    expect(popover.find('.exp-num-text').text()).toBe('63254/64000');
    expect(popover.find('.bio-text').text()).toBe('不会画图的股民不是一个好股民');

    const statsText = popover.find('.popover-stats-row').text();
    expect(statsText).toContain('1062');
    expect(statsText).toContain('获赞');
    expect(statsText).toContain('13');
    expect(statsText).toContain('关注');
    expect(statsText).toContain('191');
    expect(statsText).toContain('粉丝');
    wrapper.unmount();
  });

  it('未登录悬停弹出登录引导，点击触发器打开登录弹窗', async () => {
    const auth = useAuthStore();
    const wrapper = mount(BrandAccount);

    await wrapper.find('.brand-account').trigger('mouseenter');
    expect(wrapper.find('.popover-guest').exists()).toBe(true);
    expect(wrapper.find('.guest-login-btn').exists()).toBe(true);

    await wrapper.find('.brand-account-trigger').trigger('click');
    expect(auth.isLoginModalOpen).toBe(true);
    wrapper.unmount();
  });

  it('点击已登录头像跳转个人主页', async () => {
    const auth = useAuthStore();
    auth.isLoggedIn = true;
    auth.user = {
      uid: '1234567',
      username: '工程师股民',
      userAvatar: '',
    };

    const wrapper = mount(BrandAccount);

    await wrapper.find('.brand-account-trigger').trigger('click');
    expect(routerMock.push).toHaveBeenCalledWith('/user/me');
    wrapper.unmount();
  });
});
