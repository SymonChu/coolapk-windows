import type { PublishTopic } from './publishTopics';

export interface TopicRule { nodeType: string; nodeName: string; keyword: string; topics: string[] }
export interface TopicRecommendationConfig { recommended: string[]; rules: TopicRule[] }

// 官方 main/init 的 36839 卡及 feedRecommendTags 字段都能提供话题规则。
export function parseTopicRecommendations(response: unknown): TopicRecommendationConfig {
  const result: TopicRecommendationConfig = { recommended: [], rules: [] };
  const seen = new Set<unknown>();
  function parse(config: Record<string, unknown>) {
    for (const [key, value] of Object.entries(config)) {
      if (!Array.isArray(value)) continue;
      const titles = value.filter((item): item is string => typeof item === 'string' && !!item.trim());
      if (key === 'default') result.recommended.push(...titles);
      else if (!['cardId', 'cardPageName'].includes(key)) {
        const parts = key.split('---');
        if (parts.length === 1) result.rules.push({ nodeType: '0', nodeName: '', keyword: key, topics: titles });
        else if (parts.length === 3 && ['0', '1', '3', '7'].includes(parts[0])) result.rules.push({ nodeType: parts[0], nodeName: parts[1], keyword: parts[2], topics: titles });
      }
    }
  }
  function visit(value: unknown) {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) { value.forEach(visit); return; }
    const obj = value as Record<string, unknown>;
    if (obj.feedRecommendTags && typeof obj.feedRecommendTags === 'object') parse(obj.feedRecommendTags as Record<string, unknown>);
    if (String(obj.entityId) === '36839' && obj.extraData && typeof obj.extraData === 'object') parse(obj.extraData as Record<string, unknown>);
    Object.values(obj).forEach(visit);
  }
  visit(response);
  result.recommended = [...new Set(result.recommended)];
  return result;
}

export function recommendPublishTopics(config: TopicRecommendationConfig, text: string, cursor: number, recent: PublishTopic[], hot: PublishTopic[], nodeType = '0', nodeName = '') {
  const excluded = new Set([...text.matchAll(/#([^#\n]+)#/g)].map((match) => match[1]));
  if (nodeType === '3') excluded.add(nodeName);
  const matching = config.rules.filter((rule) => (rule.nodeType === '0' || (rule.nodeType === nodeType && (!rule.nodeName || !nodeName || rule.nodeName.toLowerCase() === nodeName.toLowerCase()))) && text.toLowerCase().includes(rule.keyword.toLowerCase()));
  matching.sort((a, b) => Math.abs(text.toLowerCase().indexOf(a.keyword.toLowerCase()) - cursor) - Math.abs(text.toLowerCase().indexOf(b.keyword.toLowerCase()) - cursor));
  const candidates = [
    ...matching.flatMap((rule) => rule.topics.map((title) => ({ title, source: '关键词' }))),
    ...config.recommended.slice(0, 2).map((title) => ({ title, source: '推荐' })),
    ...recent.map((topic) => ({ title: topic.title, source: '最近' })),
    ...hot.map((topic) => ({ title: topic.title, source: '热门' })),
  ];
  // 已插入话题和重复推荐均不再显示。
  return candidates.filter((item) => { if (excluded.has(item.title)) return false; excluded.add(item.title); return true; }).slice(0, 12);
}
