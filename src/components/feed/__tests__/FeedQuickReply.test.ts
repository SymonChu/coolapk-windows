import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  replyFeed: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('../../../api/coolapk', () => ({ CoolapkTauriAPI: { replyFeed: mocks.replyFeed } }));
vi.mock('../../../utils/toast', () => ({ showToast: mocks.showToast }));

import FeedQuickReply from '../FeedQuickReply.vue';
import { useAuthStore } from '../../../stores/auth';
import { useSettingsStore } from '../../../stores/settings';

const FEED = { id: '100', username: '海绵嫂嫂' } as any;

function mountReply(props: Record<string, unknown> = {}) {
  return mount(FeedQuickReply, { props: { feed: FEED, ...props } });
}

describe('快捷回复', () => {
  beforeEach(() => {
    mocks.replyFeed.mockReset().mockResolvedValue({});
    mocks.showToast.mockClear();
    useAuthStore().isLoggedIn = true;
    useSettingsStore().settings.quickReplyEnabled = true;
  });

  it('输入框提示带上作者名与「不打开评论页」的说明', () => {
    const input = mountReply().find('input');
    expect(input.attributes('placeholder')).toContain('海绵嫂嫂');
    expect(input.attributes('placeholder')).toContain('不打开评论页');
  });

  it('登录后直接把内容发给该动态，并清空输入框', async () => {
    const wrapper = mountReply();
    await wrapper.find('input').setValue('  好用  ');
    await wrapper.find('.qr-send').trigger('click');
    await flushPromises();

    expect(mocks.replyFeed).toHaveBeenCalledTimes(1);
    expect(mocks.replyFeed).toHaveBeenCalledWith('100', '好用');
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('');
    expect(wrapper.emitted('replied')).toHaveLength(1);
    expect(mocks.showToast).toHaveBeenCalled();
  });

  it('+1 按钮发送固定内容', async () => {
    const wrapper = mountReply();
    await wrapper.find('.qr-plus').trigger('click');
    await flushPromises();

    expect(mocks.replyFeed).toHaveBeenCalledWith('100', '+1');
  });

  it('空内容不发送', async () => {
    const wrapper = mountReply();
    await wrapper.find('input').setValue('   ');
    await wrapper.find('.qr-send').trigger('click');
    await flushPromises();

    expect(mocks.replyFeed).not.toHaveBeenCalled();
  });

  it('未登录时先弹登录，不发请求', async () => {
    const auth = useAuthStore();
    auth.isLoggedIn = false;
    const openLoginModal = vi.spyOn(auth, 'openLoginModal').mockImplementation(() => {});

    const wrapper = mountReply();
    await wrapper.find('input').setValue('测试');
    await wrapper.find('.qr-send').trigger('click');
    await flushPromises();

    expect(openLoginModal).toHaveBeenCalled();
    expect(mocks.replyFeed).not.toHaveBeenCalled();
  });

  it('发送失败给出错误提示', async () => {
    mocks.replyFeed.mockRejectedValue(new Error('网络错误'));
    const wrapper = mountReply();
    await wrapper.find('input').setValue('hi');
    await wrapper.find('.qr-send').trigger('click');
    await flushPromises();

    expect(mocks.showToast).toHaveBeenCalledWith('网络错误', 'error');
  });

  it('设置里关掉快捷回复后整行不渲染', () => {
    useSettingsStore().settings.quickReplyEnabled = false;
    expect(mountReply().find('.quick-reply').exists()).toBe(false);
  });

  it('详情页不重复提供入口', () => {
    expect(mountReply({ detailMode: true }).find('.quick-reply').exists()).toBe(false);
  });
});
