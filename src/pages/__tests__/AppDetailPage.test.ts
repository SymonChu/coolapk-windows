import { flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getAppDetail: vi.fn(), getApkRecommendList: vi.fn(),
  getApkFeeds: vi.fn(), getApkComments: vi.fn(),
}));
vi.mock('../../api/coolapk', () => ({ CoolapkTauriAPI: api }));
vi.mock('../../stores/downloads', () => ({ useDownloadStore: () => ({ initialize: vi.fn() }) }));

import AppDetailPage from '../AppDetailPage.vue';

beforeEach(() => {
  vi.clearAllMocks();
  api.getAppDetail.mockResolvedValue({ data: { id: '42', title: '应用', packageName: 'com.test.app' } });
  api.getApkRecommendList.mockResolvedValue({ data: [] });
  api.getApkFeeds.mockReset().mockResolvedValue({ data: [{ id: 'discussion', message: '讨论' }] });
  api.getApkComments.mockReset().mockResolvedValue({ data: [{ id: 'comment', message: '评论' }] });
});

async function setup() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/app/:packageName', component: AppDetailPage }] });
  await router.push('/app/com.test.app');
  const wrapper = mount(AppDetailPage, { global: {
    plugins: [createPinia(), router],
    stubs: {
      FeedCard: { props: ['feed'], template: '<div class="feed-stub">{{ feed.id }}</div>' },
      FeedCommentSection: { props: ['comments'], template: '<div class="comments-stub">{{ comments.map(c => c.id).join(",") }}</div>' },
      AppButton: true, AppImage: true, AppDialog: true, LoadingState: true, EmptyState: true, ErrorState: true,
    },
  } });
  await flushPromises();
  return wrapper;
}

describe('应用动态排序', () => {
  it('讨论切换最新和热门时重置第一页、替换旧列表，并保持后续分页排序', async () => {
    const wrapper = await setup();
    await wrapper.findAll('.detail-tab-item').find(b => b.text() === '讨论')!.trigger('click');
    await flushPromises();
    expect(api.getApkFeeds).toHaveBeenLastCalledWith('com.test.app', 'lastupdate_desc', 1);
    api.getApkFeeds.mockResolvedValue({ data: [{ id: 'latest' }] });
    await wrapper.findAll('.app-feed-sort button')[1].trigger('click');
    await flushPromises();
    expect(api.getApkFeeds).toHaveBeenLastCalledWith('com.test.app', 'dateline_desc', 1);
    expect(wrapper.find('.feed-stub').text()).toBe('latest');
    await wrapper.get('.page-container').trigger('scroll');
    await flushPromises();
    expect(api.getApkFeeds).toHaveBeenLastCalledWith('com.test.app', 'dateline_desc', 2);
    api.getApkFeeds.mockResolvedValue({ data: [{ id: 'hot' }] });
    await wrapper.findAll('.app-feed-sort button')[2].trigger('click');
    await flushPromises();
    expect(api.getApkFeeds).toHaveBeenLastCalledWith('com.test.app', 'popular', 1);
    expect(wrapper.findAll('.feed-stub').map(f => f.text())).toEqual(['hot']);
    wrapper.unmount();
  });

  it('评论排序独立于讨论，并在加载期间禁止重复切换', async () => {
    const wrapper = await setup();
    await wrapper.findAll('.detail-tab-item').find(b => b.text() === '评论')!.trigger('click');
    await flushPromises();
    expect(api.getApkComments).toHaveBeenLastCalledWith('com.test.app', 'dateline_desc', 1);
    let resolve!: (data: any) => void;
    api.getApkComments.mockReturnValueOnce(new Promise(r => { resolve = r; }));
    await wrapper.findAll('.app-feed-sort button')[2].trigger('click');
    expect(api.getApkComments).toHaveBeenLastCalledWith('com.test.app', 'popular', 1);
    expect(wrapper.findAll('.app-feed-sort button').every(b => b.attributes('disabled') !== undefined)).toBe(true);
    resolve({ data: [{ id: 'popular-comment' }] });
    await flushPromises();
    expect(wrapper.find('.comments-stub').text()).toBe('popular-comment');
    await wrapper.findAll('.detail-tab-item').find(b => b.text() === '讨论')!.trigger('click');
    await flushPromises();
    expect(api.getApkFeeds).toHaveBeenLastCalledWith('com.test.app', 'lastupdate_desc', 1);
    wrapper.unmount();
  });
});
