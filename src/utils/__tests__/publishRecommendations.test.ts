import { describe, it, expect } from 'vitest';
import { parseTopicRecommendations, recommendPublishTopics } from '../publishRecommendations';
describe('官方话题推荐规则', () => {
  it('读取配置卡并区分全局和板块规则', () => {
    const config = parseTopicRecommendations({ data: [{ entityId: '36839', extraData: { default: ['摄影'], 手机: ['数码'], '7---小米---续航': ['电池'] } }] });
    expect(config.recommended).toEqual(['摄影']);
    expect(recommendPublishTopics(config, '手机续航 #摄影#', 4, [], [], '7', '小米').map((item) => item.title)).toEqual(['电池', '数码']);
    expect(recommendPublishTopics(config, '续航', 2, [], [], '7', '苹果').map((item) => item.title)).toEqual(['摄影']);
  });
  it('排除已经插入的话题并去重历史和热门', () => {
    const topics = [{ id: '1', title: '摄影' }];
    expect(recommendPublishTopics({ recommended: [], rules: [] }, '', 0, topics, topics)).toHaveLength(1);
    expect(recommendPublishTopics({ recommended: [], rules: [] }, '#摄影#', 4, topics, topics)).toEqual([]);
  });
});
