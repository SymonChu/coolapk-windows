import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LivePhotoPreview from '../LivePhotoPreview.vue';
import type { FeedImageItem } from '../../../utils/livePhoto';

const liveItem: FeedImageItem = {
  key: 'live-1',
  sourceUrl: 'https://img.example/1.jpg',
  coverUrl: 'https://img.example/1.jpg',
  liveVideoUrl: 'https://video.example/1.mp4',
  isLivePhoto: true,
};

const originalMatchMedia = window.matchMedia;

/** jsdom 的 matchMedia 桩固定返回 false，这里按用例覆盖指针类型。 */
function stubPointer(coarse: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: coarse && query.includes('coarse'),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

describe('LivePhotoPreview 触摸端播放', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
  });

  function mountPreview(withParentClick = false) {
    const onParentClick = vi.fn();
    const wrapper = mount(LivePhotoPreview, {
      props: { item: liveItem, contentId: 1, contentType: 'feed' as const },
      ...(withParentClick ? { attrs: { onClick: onParentClick } } : {}),
    });
    return { wrapper, onParentClick };
  }

  it('触摸端点 Live 角标就地播放且不冒泡到宫格', async () => {
    stubPointer(true);
    const { wrapper, onParentClick } = mountPreview(true);

    expect(wrapper.find('.live-photo-video').exists()).toBe(false);

    await wrapper.get('.live-badge').trigger('click');
    await flushPromises();

    expect(wrapper.find('.live-photo-video').exists()).toBe(true);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    expect(onParentClick).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('再次点击角标暂停播放', async () => {
    stubPointer(true);
    const { wrapper } = mountPreview();

    await wrapper.get('.live-badge').trigger('click');
    await flushPromises();
    expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
    expect(wrapper.find('.live-photo-video').exists()).toBe(true);

    await wrapper.get('.live-badge').trigger('click');
    await flushPromises();
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
    // 回归：暂停后视频节点必须离开 DOM，否则画面会停在视频的某一帧上
    // （看起来像另一张图），而不是回到这一项自己的静态封面。
    expect(wrapper.find('.live-photo-video').exists()).toBe(false);

    // 再次点击能重新挂载并播放，不需要重新解析地址。
    await wrapper.get('.live-badge').trigger('click');
    await flushPromises();
    expect(wrapper.find('.live-photo-video').exists()).toBe(true);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
    wrapper.unmount();
  });

  it('桌面端点击不拦截，仍然冒泡打开查看器', async () => {
    stubPointer(false);
    const { wrapper, onParentClick } = mountPreview(true);

    await wrapper.get('.live-badge').trigger('click');
    await flushPromises();

    expect(onParentClick).toHaveBeenCalledTimes(1);
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
