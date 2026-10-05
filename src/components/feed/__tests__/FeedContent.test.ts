import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';

const mocks = vi.hoisted(() => ({
  getFeedDetail: vi.fn(),
}));

vi.mock('../../../api/coolapk', () => ({
  CoolapkTauriAPI: {
    getFeedDetail: mocks.getFeedDetail,
  },
}));

import FeedContent from '../FeedContent.vue';
import { clearFeedFullTextCache } from '../../../utils/feedFullTextCache';

describe('动态正文展开', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFeedFullTextCache();
  });

  it('接口截断正文会加载完整内容且不保留查看更多', async () => {
    mocks.getFeedDetail.mockResolvedValue({ data: { message: '这里是接口返回的完整正文' } });
    const wrapper = mount(FeedContent, {
      props: { feedId: '456', message: '正文摘要... 查看更多' },
      global: { plugins: [createPinia()] },
    });

    expect(wrapper.text()).not.toContain('查看更多');
    await flushPromises();
    expect(mocks.getFeedDetail).not.toHaveBeenCalled();
    await wrapper.find('.expand-btn').trigger('click');
    await flushPromises();

    expect(mocks.getFeedDetail).toHaveBeenCalledWith('456');
    expect(wrapper.text()).toContain('这里是接口返回的完整正文');
  });

  it('列表卡片加载后不访问详情，只有主动展开才请求全文', async () => {
    mocks.getFeedDetail.mockResolvedValue({ data: { message: '主动展开后取得的完整正文' } });
    const wrapper = mount(FeedContent, {
      props: { feedId: '789', message: '正文摘要... 查看更多' },
      global: { plugins: [createPinia()] },
    });

    await flushPromises();
    expect(mocks.getFeedDetail).not.toHaveBeenCalled();
    expect(wrapper.find('.feed-body').classes()).toContain('is-collapsed');

    await wrapper.find('.expand-btn').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('主动展开后取得的完整正文');
    expect(mocks.getFeedDetail).toHaveBeenCalledTimes(1);
  });

  it('回答卡片在标题前显示明确的回答标识', () => {
    const wrapper = mount(FeedContent, {
      props: { title: '回答标题', message: '回答正文', answerMode: true },
      global: { plugins: [createPinia()] },
    });

    expect(wrapper.find('.answer-title-badge').text()).toBe('回答');
    expect(wrapper.find('.feed-title').text()).toContain('回答标题');
  });

  it('全文请求失败后恢复按钮，再次展开可以取得完整内容', async () => {
    mocks.getFeedDetail.mockRejectedValueOnce(new Error('验证码加载失败')).mockResolvedValueOnce({ data: { message: '重试后的完整正文' } });
    const wrapper = mount(FeedContent, {
      props: { feedId: '456', message: '正文摘要... 查看更多' },
      global: { plugins: [createPinia()] },
    });

    await wrapper.find('.expand-btn').trigger('click');
    await flushPromises();
    expect(wrapper.find('.expand-btn').attributes('disabled')).toBeUndefined();
    expect(wrapper.find('.expand-btn').text()).toBe('全文加载失败，重试');
    await wrapper.find('.expand-btn').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('重试后的完整正文');
    expect(mocks.getFeedDetail).toHaveBeenCalledTimes(2);
  });

  it('提问卡片在标题前显示明确的提问标识', () => {
    const wrapper = mount(FeedContent, {
      props: { title: '问题标题', message: '问题正文', questionMode: true },
      global: { plugins: [createPinia()] },
    });

    expect(wrapper.find('.question-title-badge').text()).toBe('提问');
    expect(wrapper.find('.feed-title').text()).toContain('问题标题');
  });
});
