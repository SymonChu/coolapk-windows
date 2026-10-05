import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import BackToTop from '../BackToTop.vue';

vi.mock('vue-router', () => ({
  useRoute: () => ({
    path: '/',
  }),
}));

describe('BackToTop', () => {
  it('nav 形态渲染为顶部导航栏图标按钮', async () => {
    const scrollToSpy = vi.fn();
    window.scrollTo = scrollToSpy;

    const wrapper = mount(BackToTop, {
      props: {
        variant: 'nav',
      },
    });

    const button = wrapper.find('.scroll-to-top-nav-btn');
    expect(button.exists()).toBe(true);
    expect(button.attributes('title')).toBe('回到顶部');
    expect(button.find('i').classes()).toContain('fa-arrow-up');

    await button.trigger('click');
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('默认 floating 形态初始不展示，当滚动超过 300px 时显示', async () => {
    const scrollToSpy = vi.fn();
    window.scrollTo = scrollToSpy;

    const wrapper = mount(BackToTop);

    expect(wrapper.find('.back-to-top-btn').exists()).toBe(false);

    // 模拟滚动事件
    window.scrollY = 450;
    window.dispatchEvent(new Event('scroll'));
    await wrapper.vm.$nextTick();

    const floatingBtn = wrapper.find('.back-to-top-btn');
    expect(floatingBtn.exists()).toBe(true);
    expect(floatingBtn.attributes('title')).toBe('回到顶部');

    await floatingBtn.trigger('click');
    expect(scrollToSpy).toHaveBeenCalled();
  });
});
