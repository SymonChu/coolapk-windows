<template>
  <div v-if="shouldRender" class="sidebar-card">
    <div class="card-header">
      <h3 class="card-title">我关注的话题</h3>
      <button class="refresh-btn" title="刷新" @click="fetchTopics()">
        <i class="fas fa-sync-alt"></i>
      </button>
    </div>

    <div v-if="loading" class="loading-wrapper">
      <LoadingState text="正在获取关注的话题" />
    </div>
    <div v-else-if="topics.length === 0" class="empty-wrapper">
      <p class="empty-hint">还没有关注任何话题</p>
    </div>
    <div v-else class="topic-list">
      <router-link
        v-for="topic in topics"
        :key="topic.key"
        :to="`/topic/${encodeURIComponent(topic.tag)}`"
        class="topic-item"
      >
        <span class="topic-mark">#</span>
        <span class="topic-tag">{{ topic.tag }}</span>
        <span v-if="topic.unread" class="topic-unread">新 {{ topic.unread }}</span>
      </router-link>
    </div>

    <router-link class="manage-entry" to="/followed-topics">
      <i class="fas fa-plus" aria-hidden="true"></i>
      <span>管理我关注的话题</span>
    </router-link>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { useAuthStore } from '../../stores/auth';
import { useSettingsStore } from '../../stores/settings';
import LoadingState from '../common/LoadingState.vue';

interface TopicEntry {
  key: string;
  tag: string;
  unread?: number;
}

const MAX_TOPICS = 6;
/** 未读角标只在服务端确实给出「未读」语义字段时才显示，不拿关注数冒充。 */
const UNREAD_FIELDS = ['newFeedsCount', 'unreadCount', 'newCount', 'unread', 'newFeeds', 'newReplyCount'];

const authStore = useAuthStore();
const settingsStore = useSettingsStore();
const topics = ref<TopicEntry[]>([]);
const loading = ref(false);

const shouldRender = computed(() => settingsStore.settings.showHomeFollowedTopics !== false
  && authStore.isLoggedIn);

function firstUnread(source: Record<string, unknown>): number | undefined {
  for (const field of UNREAD_FIELDS) {
    const value = Number(source?.[field]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return undefined;
}

/** 服务端条目结构在不同接口版本间会变，这里退化为「标题 / URL 里的 tag」两种来源。 */
function resolveTag(item: Record<string, unknown>): string {
  const direct = String(item?.title || item?.tag || item?.entityTitle || '').trim();
  if (direct) return direct.replace(/^#/, '');
  const url = String(item?.url || item?.entityId || item?.entityIdOrUri || '');
  const matched = url.match(/(?:topic\/|coolapk:\/\/topic\/)([^?&#]+)/i);
  if (!matched) return '';
  try {
    return decodeURIComponent(matched[1]).replace(/^#/, '');
  } catch {
    return matched[1].replace(/^#/, '');
  }
}

function parseTopics(response: unknown): TopicEntry[] {
  const payload = response as { data?: unknown } | null;
  const rawData = payload?.data;
  const list = Array.isArray(rawData)
    ? rawData
    : (Array.isArray((rawData as { data?: unknown })?.data) ? (rawData as { data: unknown[] }).data : []);
  const result: TopicEntry[] = [];
  list.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') return;
    const tag = resolveTag(entry as Record<string, unknown>);
    if (!tag) return;
    result.push({
      key: String((entry as Record<string, unknown>).entityId
        || (entry as Record<string, unknown>).id
        || tag
        || index),
      tag,
      unread: firstUnread(entry as Record<string, unknown>),
    });
  });
  return result.slice(0, MAX_TOPICS);
}

async function fetchTopics() {
  if (!authStore.isLoggedIn) {
    topics.value = [];
    return;
  }
  loading.value = true;
  try {
    const res = await CoolapkTauriAPI.getFollowedTopics(1);
    topics.value = parseTopics(res);
  } catch (err) {
    console.warn('获取我关注的话题失败', err);
    topics.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  if (shouldRender.value) void fetchTopics();
});

watch(() => authStore.isLoggedIn, (loggedIn) => {
  if (loggedIn) void fetchTopics();
  else topics.value = [];
});
</script>

<style scoped>
.sidebar-card {
  background-color: var(--surface);
  border-radius: var(--radius-card);
  border: 1px solid var(--border);
  padding: var(--space-4);
  margin-bottom: var(--space-4);
  overflow: hidden;
  min-width: 0;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.card-title {
  margin: 0;
  font-size: 17px;
  line-height: 22px;
  font-weight: 700;
  color: var(--text-primary);
}

.refresh-btn {
  border: 0;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 12px;
  padding: 3px 0;
  cursor: pointer;
  transition: color var(--duration-fast) var(--ease-default);
}

.refresh-btn:hover {
  color: var(--brand-primary);
}

.loading-wrapper,
.empty-wrapper {
  padding: 8px 0;
}

.empty-hint {
  margin: 0;
  color: var(--text-tertiary);
  font-size: 13px;
}

.topic-list {
  display: flex;
  flex-direction: column;
}

.topic-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 4px 0;
  text-decoration: none;
  min-width: 0;
}

.topic-mark {
  flex: 0 0 auto;
  color: var(--text-tertiary);
  font-size: 13px;
  font-weight: 700;
}

.topic-tag {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 14px;
  line-height: 19px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topic-unread {
  flex: 0 0 auto;
  color: var(--brand-primary);
  font-size: 11.5px;
  font-weight: 600;
  white-space: nowrap;
}

.topic-item:hover .topic-tag,
.topic-item:hover .topic-mark {
  color: var(--brand-primary);
}

.manage-entry {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
  color: var(--text-tertiary);
  font-size: 12px;
  text-decoration: none;
}

.manage-entry:hover {
  color: var(--brand-primary);
}
</style>
