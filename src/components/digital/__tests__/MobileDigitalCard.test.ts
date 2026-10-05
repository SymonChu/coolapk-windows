import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import MobileDigitalCard from '../MobileDigitalCard.vue';
import type { DiscoveryEntity } from '../../../types/discovery';

function render(entity: DiscoveryEntity) {
  return mount(MobileDigitalCard, { props: { entity }, global: { stubs: { AppImage: true, DiscoveryEntityCard: true } } });
}
describe('官方移动数码卡片', () => {
  it('分类使用五列，点击发送服务端原始入口，不替换为静态内容', async () => {
    const item = { title: '手机', pic: 'https://example.com/phone.png', url: '/product/categoryList?id=1000' };
    const wrapper = render({ entityTemplate: 'iconLinkGridCard', entities: [item] });
    expect(wrapper.find('.category-grid').attributes('style')).toContain('repeat(5');
    await wrapper.find('.grid-item').trigger('click');
    expect(wrapper.emitted('open')?.[0]).toEqual([item]);
  });
  it('榜单四列、编号、热度和服务端榜单链接，省去报价与配置', async () => {
    const entity = { title: '今日热门', subTitle: '榜单', url: '#/page?url=V14_JINRIREMEN', entityTemplate: 'iconLongTitleGridCard', extraData: '{"withRanking":"1","cols":"4"}', entities: [{ title: '手机型号', entityType: 'product', logo: 'https://example.com/p.png', hot_num_txt: '47.8万', price_min: 2999 }] };
    const wrapper = render(entity);
    expect(wrapper.find('.card-grid').attributes('style')).toContain('repeat(4');
    expect(wrapper.find('.rank-ribbon').text()).toBe('1');
    expect(wrapper.find('.grid-hot').text()).toBe('47.8万');
    expect(wrapper.text()).not.toContain('2999');
    await wrapper.find('.card-heading button').trigger('click');
    expect(wrapper.emitted('open')?.[0]).toEqual([entity]);
  });
  it('时间线展示日期和年份，保留未公布日期，点击进入产品', async () => {
    const item = { title: '新品', entityType: 'product', url: '/product/42', release_time: '2026年10月12日', release_status: 0, hot_num_txt: '10万' };
    const wrapper = render({ title: '发布日历', entityTemplate: 'productTimelineListCard', entities: [item, { title: '待发布', release_time: '2026年下半年' }] });
    expect(wrapper.findAll('.release-date')[0]!.text()).toBe('10.122026');
    expect(wrapper.findAll('.release-date')[1]!.text()).toBe('下半年2026');
    expect(wrapper.find('.row-hot').exists()).toBe(false);
    await wrapper.find('.product-row').trigger('click');
    expect(wrapper.emitted('open')?.[0]).toEqual([item]);
  });
  it('轮播图使用真实子项链接及分页点', async () => {
    const items = [{ title: '选机中心', pic: 'https://example.com/a.png', url: '/productSelector' }, { title: '手机对比', pic: 'https://example.com/b.png', url: '/productCompare' }];
    const wrapper = render({ entityTemplate: 'imageCarouselCard_1', entities: items });
    expect(wrapper.findAll('.banner-dots button')).toHaveLength(2);
    await wrapper.find('.banner-track button').trigger('click');
    expect(wrapper.emitted('open')?.[0]).toEqual([items[0]]);
  });
  it('动态分组逐条渲染完整动态，避免桌面双列压缩作者信息', () => {
    const wrapper = render({ entityTemplate: 'feedListCard', entities: [{ entityType: 'feed', id: 123 }] });
    expect(wrapper.find('.mobile-feed-group').exists()).toBe(true);
    expect(wrapper.find('discovery-entity-card-stub').attributes('entity')).toBe('[object Object]');
  });
});
