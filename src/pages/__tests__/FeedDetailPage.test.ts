import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { ref } from 'vue';

const mocks = vi.hoisted(() => ({ detail: vi.fn(), context: vi.fn(), save: vi.fn() }));
vi.mock('../../api/coolapk', () => ({ CoolapkTauriAPI: { getFeedDetail: mocks.detail } }));
vi.mock('../../stores/app', () => ({ useAppStore: () => ({ getFeedDetailContext: mocks.context, setFeedDetailContext: mocks.save }) }));
vi.mock('vue-router', () => ({ useRouter: () => ({}) }));
vi.mock('../../router', () => ({ router: { push: vi.fn(), resolve: vi.fn(() => ({ matched: [] })) } }));
vi.mock('../../composables/usePageTabTitle', () => ({ usePageTabTitle: () => {} }));
vi.mock('../../composables/useOfficialMobileFeedDetail', () => ({ useOfficialMobileFeedDetail: () => ref(true) }));
import FeedDetailPage from '../FeedDetailPage.vue';

describe('官方详情评论加载', () => {
  it('有完整列表上下文时，详情请求未完成也立即开启评论', async () => {
    let finish!: (value: unknown) => void;
    mocks.detail.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    mocks.context.mockReturnValue({ id: '42', uid: '1', username: '作者', message: '正文', replynum: 40 });
    const wrapper = mount(FeedDetailPage, {
      props: { feedId: '42' },
      global: { stubs: { FeedCard: { props: ['autoOpenComments'], template: '<div class="comments" :data-open="autoOpenComments" />' }, QuestionAnswerCard: true, LoadingState: true, ErrorState: true, EmptyState: true } },
    });
    expect(mocks.detail).toHaveBeenCalledWith('42');
    expect(wrapper.find('.comments').attributes('data-open')).toBe('true');
    finish({ data: { id: '42', uid: '1', username: '作者', message: '完整正文' } });
    await flushPromises();
    expect(wrapper.find('.comments').attributes('data-open')).toBe('true');
    wrapper.unmount();
  });
  it('仅有通知摘要时不提前挂载动态或请求评论', async () => {
    let finish!: (value: unknown) => void;
    mocks.detail.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    mocks.context.mockReturnValue({ id: '42', title: '通知摘要' });
    const wrapper = mount(FeedDetailPage, { props: { feedId: '42' }, global: { stubs: { FeedCard: true, QuestionAnswerCard: true, LoadingState: true, ErrorState: true, EmptyState: true } } });
    expect(wrapper.find('feed-card-stub').exists()).toBe(false);
    finish({ data: { id: '42', uid: '1', username: '作者', message: '完整正文' } });
    await flushPromises();
    expect(wrapper.find('feed-card-stub').attributes('autoopencomments')).toBe('true');
    wrapper.unmount();
  });
});
