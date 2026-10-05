import { readTauriStoreValue, writeTauriStoreValue } from './tauriStore';

export interface PublishTopic { id: string; title: string; logo?: string }

// 搜索接口可能返回标题卡、话题卡或分组，统一展开后仅保留可选择话题。
export function normalizePublishTopics(value: unknown): PublishTopic[] {
  const result = new Map<string, PublishTopic>();
  function visit(items: unknown) {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      if (Array.isArray(item.entities)) visit(item.entities);
      if (Array.isArray(item.data)) visit(item.data);
      const title = String(item.title || item.tag || item.entityTitle || '').replace(/^#|#$/g, '').trim();
      if (!title || !item.id || (item.entityType && !['topic', 'feedTopic', 'tag'].includes(item.entityType))) continue;
      result.set(String(item.id), { id: String(item.id), title, logo: item.logo || item.icon || item.pic || item.cover });
    }
  }
  visit(value);
  return [...result.values()];
}

export async function loadRecentPublishTopics(uid: string): Promise<PublishTopic[]> {
  return normalizePublishTopics(await readTauriStoreValue('publish_topics.json', uid));
}

export async function rememberPublishTopic(uid: string, topic: PublishTopic): Promise<void> {
  const recent = await loadRecentPublishTopics(uid);
  await writeTauriStoreValue('publish_topics.json', uid, [topic, ...recent.filter((item) => item.id !== topic.id)].slice(0, 30));
}

export async function clearRecentPublishTopics(uid: string): Promise<void> {
  await writeTauriStoreValue('publish_topics.json', uid, []);
}
