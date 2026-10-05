import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../../../stores/app';
import { useSettingsStore } from '../../../stores/settings';

const mocks = vi.hoisted(() => ({
  openImageInSystemViewer: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../api/coolapk', () => ({
  CoolapkTauriAPI: {
    openImageInSystemViewer: mocks.openImageInSystemViewer,
    getImageDataUrl: vi.fn().mockResolvedValue('data:image/png;base64,AA'),
  },
}));

import FeedImageGrid from '../FeedImageGrid.vue';

const originalUserAgent = navigator.userAgent;
const originalPlatform = navigator.platform;

function stubIOSDevice() {
  Object.defineProperty(window.navigator, 'userAgent', {
    value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15',
    configurable: true,
  });
  Object.defineProperty(window.navigator, 'platform', { value: 'iPhone', configurable: true });
}

function mountGrid() {
  return mount(FeedImageGrid, {
    props: { images: ['https://img.example/1.jpg', 'https://img.example/2.jpg'] },
    global: { stubs: { LivePhotoPreview: true } },
  });
}

describe('FeedImageGrid 点击打开方式', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
  });

  afterEach(() => {
    Object.defineProperty(window.navigator, 'userAgent', { value: originalUserAgent, configurable: true });
    Object.defineProperty(window.navigator, 'platform', { value: originalPlatform, configurable: true });
  });

  it('桌面端选择系统查看器时交给系统打开', async () => {
    useSettingsStore().settings.imageOpenMode = 'system';
    const wrapper = mountGrid();

    await wrapper.findAll('.grid-item')[0].trigger('click');
    await flushPromises();

    expect(mocks.openImageInSystemViewer).toHaveBeenCalledTimes(1);
    expect(useAppStore().activeImageViewer).toBeNull();
    wrapper.unmount();
  });

  it('iOS 上即使选了系统查看器也回落到内置查看器', async () => {
    stubIOSDevice();
    useSettingsStore().settings.imageOpenMode = 'system';
    const wrapper = mountGrid();

    await wrapper.findAll('.grid-item')[0].trigger('click');
    await flushPromises();

    expect(mocks.openImageInSystemViewer).not.toHaveBeenCalled();
    expect(useAppStore().activeImageViewer?.currentIndex).toBe(0);
    wrapper.unmount();
  });

  it('iOS 内置查看器模式按点击顺序打开对应图片', async () => {
    stubIOSDevice();
    const wrapper = mountGrid();

    await wrapper.findAll('.grid-item')[1].trigger('click');
    await flushPromises();

    expect(useAppStore().activeImageViewer?.currentIndex).toBe(1);
    wrapper.unmount();
  });
});
