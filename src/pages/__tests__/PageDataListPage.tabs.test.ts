import { mount, flushPromises } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { describe, it, expect, vi } from 'vitest';
const api = vi.hoisted(() => ({ getDiscoveryPageData: vi.fn() }));
vi.mock('../../api/coolapk', () => ({ CoolapkTauriAPI: api }));
vi.mock('vue-router', async (importOriginal) => ({ ...await importOriginal<typeof import('vue-router')>(), useRoute: () => ({ query: { url: 'V14_JINRIREMEN', title: '今日热门', renderer: 'discovery' } }), useRouter: () => ({ push: vi.fn() }) }));
import PageDataListPage from '../PageDataListPage.vue';
it('榜单标签自动请求首项，切换分类重置分页并加载对应产品', async () => {
  api.getDiscoveryPageData.mockImplementation(async ({ url }: { url: string }) => url === 'V14_JINRIREMEN'
    ? { data: [{ entityType: 'card', entityTemplate: 'iconTabLinkGridCard', entities: [{ title: '今日热议', url: '#/product/hotProductList?hotType=day' }, { title: '热议新机', url: '#/product/unreleasedProductList' }] }] }
    : { data: [{ entityType: 'product', id: 1, title: url.includes('unreleased') ? '新机' : '热门手机', hot_num_txt: '10万' }] });
  const wrapper = mount(PageDataListPage, { global: { plugins: [createPinia()], stubs: { AppImage: true, DiscoveryEntityCard: true, FeedSkeleton: true } } });
  await flushPromises();
  expect(wrapper.findAll('.dynamic-tabs button')).toHaveLength(2);
  expect(wrapper.find('.ranking-copy').text()).toContain('热门手机');
  expect(api.getDiscoveryPageData).toHaveBeenLastCalledWith(expect.objectContaining({ url: '#/product/hotProductList?hotType=day', page: 1 }));
  await wrapper.findAll('.dynamic-tabs button')[1]!.trigger('click');
  await flushPromises();
  expect(wrapper.find('.ranking-copy').text()).toContain('新机');
  expect(api.getDiscoveryPageData).toHaveBeenLastCalledWith(expect.objectContaining({ url: '#/product/unreleasedProductList', page: 1, firstItem: '', lastItem: '' }));
});
