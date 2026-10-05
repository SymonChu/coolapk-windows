import { describe, expect, it } from 'vitest';
import { productTabs } from '../productTabs';

const serverTab = (title: string, type: string, id = '5136') => ({
  title,
  url: `/page?url=${encodeURIComponent(`/product/feedList?type=${type}&id=${id}`)}`,
});

describe('official product tabs', () => {
  it('uses tabList order, labels, and visibility without injecting local tabs', () => {
    const tabs = [
      serverTab('讨论', 'feed'),
      { title: '样张', page_name: '4', url: `/page?url=${encodeURIComponent('/product/feedList?type=subTabFeed&id=5136&subId=4')}`, is_open: '1' },
      serverTab('图文', 'article'),
      { title: '隐藏', page_name: 'hidden', url: '/topic/tagList?keywords=hidden', is_open: '0' },
      { title: '鸿蒙', page_name: 'diy929844', url: '/topic/tagList?keywords=华为' },
      serverTab('其他产品', 'feed', '8'),
    ];
    expect(productTabs('5136', tabs).map(({ key, label }) => [key, label])).toEqual([
      ['feed', '讨论'], ['subtab:4', '样张'], ['article', '图文'], ['page:diy929844', '鸿蒙'],
    ]);
    expect(productTabs('5136', tabs)[1].subId).toBe('4');
  });

  it('does not invent tabs when the API has none', () => {
    expect(productTabs('5136', null)).toEqual([]);
    expect(productTabs('5136', [])).toEqual([]);
  });

  it('follows the complete server order when later columns are added', () => {
    const tabs = [
      serverTab('参数', 'main'), serverTab('讨论', 'feed'),
      { title: '样张', page_name: '4', url: `/page?url=${encodeURIComponent('/product/feedList?type=subTabFeed&id=5136&subId=4')}` },
      serverTab('点评', 'rating'), serverTab('图文', 'article'),
      { title: '鸿蒙', page_name: 'diy929844', url: '/topic/tagList?keywords=华为' },
      serverTab('问答', 'answer'), serverTab('视频', 'video'), serverTab('交易', 'trade'),
    ];
    expect(productTabs('5136', tabs).map((tab) => tab.label)).toEqual([
      '参数', '讨论', '样张', '点评', '图文', '鸿蒙', '问答', '视频', '交易',
    ]);
  });
});
