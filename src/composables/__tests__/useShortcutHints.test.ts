import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useShortcutHints } from '../useShortcutHints';
import { useSettingsStore } from '../../stores/settings';

describe('快捷键提示的布局判据', () => {
  const originalWidth = window.innerWidth;
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Windows');
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1024 });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    window.innerWidth = originalWidth;
  });
  function render() {
    return mount({ setup: () => ({ show: useShortcutHints() }), template: '<span>{{ show }}</span>' });
  }
  it.each(['Android', 'iPhone', 'iPad'])('宽屏 %s 也隐藏提示，忽略桌面强制布局设置', (ua) => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua);
    useSettingsStore().settings.disableAutoMobileMode = true;
    const wrapper = render();
    expect(wrapper.text()).toBe('false');
    wrapper.unmount();
  });
  it('桌面切换到移动布局后隐藏，恢复宽窗口后重新显示', async () => {
    const wrapper = render();
    expect(wrapper.text()).toBe('true');
    window.innerWidth = 720;
    window.dispatchEvent(new Event('resize'));
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toBe('false');
    window.innerWidth = 1024;
    window.dispatchEvent(new Event('resize'));
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toBe('true');
    wrapper.unmount();
  });
  it('窄窗口强制桌面布局时保留提示', () => {
    window.innerWidth = 400;
    useSettingsStore().settings.disableAutoMobileMode = true;
    const wrapper = render();
    expect(wrapper.text()).toBe('true');
    wrapper.unmount();
  });
});
