import { describe, expect, it } from 'vitest';
import { productRatingRows, productRatingSortOptions } from '../productRatingSort';

describe('official product rating sort card', () => {
  it('uses server option order and URL, and excludes other products', () => {
    const option = (title: string, path: string) => ({ title, url: `/page?url=${encodeURIComponent(path)}` });
    const response = { data: [
      { entityType: 'singleRatingCard', title: '我的打分' },
      { entityTemplate: 'sortSelectCard', entities: [
        option('机主', '/product/feedList?type=rating&isOwner=1&id=5136'),
        option('最新', '/product/feedList?type=rating&id=5136&listType=dateline_desc'),
        option('好评', '/product/feedList?type=ratingByScore&id=5136'),
        option('其他产品', '/product/feedList?type=rating&id=8'),
      ] },
      { entityType: 'feed', id: 1 },
    ] };
    expect(productRatingSortOptions('5136', response).map((item) => item.label)).toEqual(['机主', '最新', '好评']);
    expect(productRatingRows(response).map((item) => item.id)).toEqual([1]);
  });
});
