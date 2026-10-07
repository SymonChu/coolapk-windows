import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { describe, it, expect, beforeEach } from 'vitest';

import BrandLogo from '../BrandLogo.vue';
import { useAuthStore } from '../../../stores/auth';

describe('BrandLogo（顶栏左上角品牌块）', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('始终显示酷安 logo 与名称', () => {
    const wrapper = mount(BrandLogo);

    expect(wrapper.find('.brand-logo').exists()).toBe(true);
    expect(wrapper.find('.brand-name').text()).toBe('酷安');
    wrapper.unmount();
  });

  it('登录后也不变成头像（头像在顶栏右上角 AccountEntry）', () => {
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

    const wrapper = mount(BrandLogo);

    expect(wrapper.find('.brand-logo').exists()).toBe(true);
    expect(wrapper.find('.brand-name').text()).toBe('酷安');
    expect(wrapper.find('.app-avatar-container').exists()).toBe(false);
    wrapper.unmount();
  });

  it('左栏收起时只留 logo（名称隐藏由 is-collapsed 控制）', () => {
    const wrapper = mount(BrandLogo, { props: { collapsed: true } });

    expect(wrapper.classes()).toContain('is-collapsed');
    expect(wrapper.find('.brand-logo').exists()).toBe(true);
    wrapper.unmount();
  });
});
