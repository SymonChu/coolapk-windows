<template>
  <PublishOptionSheet :is-open="true" title="选择话题" @close="emit('close')">
  <template #search>    <div class="publish-search"><i class="fas fa-search"></i><input v-model="query" placeholder="搜索话题" aria-label="搜索话题" @keydown.enter.prevent="search(true)" /></div></template>
  <section class="topic-picker" aria-label="选择话题">

    <p v-if="error" role="alert">{{ error }} <button type="button" @click="search(true)">重试</button></p>
    <template v-if="!query.trim() && recent.length">
      <div class="publish-picker-heading">最近参与 <button type="button" @click="clearRecent">清空</button></div>
      <button v-for="topic in recent" :key="topic.id" type="button" class="topic-choice publish-picker-item" @mousedown.prevent @click="choose(topic)"><span class="publish-picker-icon">#</span><span class="publish-picker-name">#{{ topic.title }}#</span><i class="fas fa-chevron-right publish-picker-arrow"></i></button>
    </template>
    <div class="publish-picker-heading">{{ query.trim() ? '搜索结果' : '热门话题' }}</div>
    <button v-for="topic in topics" :key="topic.id" type="button" class="topic-choice publish-picker-item" @mousedown.prevent @click="choose(topic)"><span class="publish-picker-icon">#</span><span class="publish-picker-name">#{{ topic.title }}#</span><i class="fas fa-chevron-right publish-picker-arrow"></i></button>
    <p v-if="loading" class="publish-picker-state">正在获取话题…</p>
    <p v-else-if="!topics.length && !error" class="publish-picker-state">暂无话题</p>
    <button v-if="hasMore && !loading" class="publish-picker-more" type="button" @click="search(false)">加载更多</button>
    <button v-if="query.trim()" class="publish-picker-more" type="button" @mousedown.prevent @click="emit('select', { id: '', title: query.trim().replace(/^#|#$/g, '') })">插入自定义话题 #{{ query.trim() }}#</button>
  </section>
  </PublishOptionSheet>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue';
import PublishOptionSheet from './PublishOptionSheet.vue';
import '../../styles/publish.css';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { normalizePublishTopics, loadRecentPublishTopics, rememberPublishTopic, clearRecentPublishTopics, type PublishTopic } from '../../utils/publishTopics';

const props = defineProps<{ uid: string; initialQuery?: string }>();
const emit = defineEmits<{ select: [topic: PublishTopic]; close: [] }>();
const query = ref(props.initialQuery || '');
const topics = ref<PublishTopic[]>([]);
const recent = ref<PublishTopic[]>([]);
const loading = ref(false);
const error = ref('');
const hasMore = ref(false);
let page = 0;
let revision = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

// 搜索响应按请求序号校验，防止旧关键词覆盖新结果。
async function search(reset: boolean) {
  clearTimeout(timer);
  const request = ++revision;
  const nextPage = reset ? 1 : page + 1;
  if (reset) { topics.value = []; hasMore.value = false; }
  loading.value = true;
  error.value = '';
  try {
    const response = await CoolapkTauriAPI.searchPublishTopics(query.value.trim(), nextPage, query.value.trim() ? '' : recent.value.map((item) => item.id).join(','));
    if (request !== revision) return;
    if (response?.code !== 200) throw new Error(response?.message || '获取话题失败');
    const items = normalizePublishTopics(response.data);
    const previous = reset ? [] : topics.value;
    topics.value = [...new Map([...previous, ...items].map((item) => [item.id, item])).values()];
    page = nextPage;
    hasMore.value = items.length > 0 && (reset || topics.value.length > previous.length);
  } catch (failure) {
    if (request === revision) error.value = String(failure instanceof Error ? failure.message : failure);
  } finally {
    if (request === revision) loading.value = false;
  }
}

async function choose(topic: PublishTopic) {
  // 存储失败不阻止用户插入话题。
  try { await rememberPublishTopic(props.uid, topic); } catch (failure) { console.warn('保存最近话题失败', failure); }
  emit('select', topic);
}
async function clearRecent() { await clearRecentPublishTopics(props.uid); recent.value = []; await search(true); }
watch(query, () => { ++revision; loading.value = false; topics.value = []; hasMore.value = false; clearTimeout(timer); timer = setTimeout(() => void search(true), 500); });
watch(() => props.initialQuery, (value) => { if (value !== undefined) query.value = value; });
watch(() => props.uid, async (uid) => { ++revision; recent.value = await loadRecentPublishTopics(uid); await search(true); }, { immediate: true });
onBeforeUnmount(() => { ++revision; clearTimeout(timer); });
</script>

<style scoped>
.topic-picker { min-height: 280px; }
p[role=alert] { color: var(--text-secondary); padding: 12px 0; }
p[role=alert] button { color: var(--brand-primary); }
</style>
