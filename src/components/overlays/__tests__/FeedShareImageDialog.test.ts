import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../../../stores/app';

const mocks = vi.hoisted(() => ({
  generateFeedShareImage: vi.fn(),
  getFeedReplies: vi.fn(),
}));

vi.mock('../../../utils/feedShareImage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../utils/feedShareImage')>();
  return { ...actual, generateFeedShareImage: mocks.generateFeedShareImage };
});

vi.mock('../../../api/coolapk', () => ({
  CoolapkTauriAPI: {
    getFeedReplies: mocks.getFeedReplies,
    saveImageDataUrl: vi.fn(),
  },
}));

import FeedShareImageDialog from '../FeedShareImageDialog.vue';

describe('FeedShareImageDialog 预览', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    mocks.getFeedReplies.mockRejectedValue(new Error('热评接口不可用'));
    mocks.generateFeedShareImage.mockResolvedValue({
      dataUrl: 'data:image/png;base64,AAAA',
      failedImageUrls: [],
    });
  });

  it('点击预览用看图器打开，便于在手机上放大查看', async () => {
    const wrapper = mount(FeedShareImageDialog, {
      props: { show: true, feed: { id: '1', message: '动态正文' } },
      global: { stubs: { Teleport: true } },
    });
    await flushPromises();

    expect(wrapper.find('.share-preview').exists()).toBe(true);
    await wrapper.get('.share-preview').trigger('click');

    const viewer = useAppStore().activeImageViewer;
    expect(viewer).not.toBeNull();
    expect(viewer?.urls).toEqual(['data:image/png;base64,AAAA']);
    expect(viewer?.currentIndex).toBe(0);
    wrapper.unmount();
  });

  it('没有生成结果时不打开看图器', async () => {
    mocks.generateFeedShareImage.mockRejectedValue(new Error('生成失败'));
    const wrapper = mount(FeedShareImageDialog, {
      props: { show: true, feed: { id: '2', message: '动态正文' } },
      global: { stubs: { Teleport: true } },
    });
    await flushPromises();

    expect(wrapper.find('.share-preview').exists()).toBe(false);
    expect(useAppStore().activeImageViewer).toBeNull();
    wrapper.unmount();
  });
});
