<template>
  <div v-if="recommendations.length" class="recommendations" aria-label="推荐话题">
    <!-- 话题保持单行横向浏览，来源放入提示，避免重复标签挤占正文空间。 -->
    <div class="recommendations-track">
      <button v-for="item in recommendations" :key="item.title" type="button" :title="`${item.source}话题：${item.title}`" :aria-label="`插入话题${item.title}`" @mousedown.prevent @click="emit('select', item.title)"><span class="topic-symbol" aria-hidden="true">#</span><span class="topic-title">{{ item.title }}</span></button>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { parseTopicRecommendations, recommendPublishTopics, type TopicRecommendationConfig } from '../../utils/publishRecommendations';
import { loadRecentPublishTopics, normalizePublishTopics, type PublishTopic } from '../../utils/publishTopics';
const props = defineProps<{ uid: string; text: string; cursor: number; nodeType?: string; nodeName?: string; refresh?: number }>();
const emit = defineEmits<{ select: [title: string] }>();
const config = ref<TopicRecommendationConfig>({ recommended: [], rules: [] });
const hot = ref<PublishTopic[]>([]);
const recent = ref<PublishTopic[]>([]);
let revision = 0;
const recommendations = computed(() => recommendPublishTopics(config.value, props.text, props.cursor, recent.value, hot.value, props.nodeType, props.nodeName));
// 两个来源独立读取，其中一个失败仍显示另一个来源的推荐。
watch(() => props.uid, async (uid) => {
  const request = ++revision;
  const results = await Promise.allSettled([CoolapkTauriAPI.getTabConfig(), CoolapkTauriAPI.searchPublishTopics('', 1), loadRecentPublishTopics(uid)]);
  if (request !== revision) return;
  if (results[0].status === 'fulfilled') config.value = parseTopicRecommendations(results[0].value);
  if (results[1].status === 'fulfilled') hot.value = normalizePublishTopics(results[1].value?.data);
  if (results[2].status === 'fulfilled') recent.value = results[2].value;
}, { immediate: true });
watch(() => props.refresh, async () => { const uid = props.uid; const value = await loadRecentPublishTopics(uid); if (uid === props.uid) recent.value = value; });
</script>
<style scoped>
.recommendations { display: flex; gap: 12px; margin-top: 12px; min-width: 0; align-items: center; }
.recommendations-track { display: flex; gap: 8px; min-width: 0; flex: 1; overflow-x: auto; padding: 3px 2px 5px; scrollbar-width: thin; scrollbar-color: transparent transparent; }
.recommendations-track:hover { scrollbar-color: var(--border) transparent; }
button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
  max-width: 220px;
  padding: 5px 12px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 18px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
button:hover {
  background: var(--brand-soft);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
  transform: translateY(-1.5px);
  box-shadow: 0 3px 10px rgba(47, 160, 111, 0.15);
}
button:active {
  transform: scale(0.95);
}
button:focus-visible { outline: 2px solid var(--brand-primary); outline-offset: 1px; }
.topic-symbol { color: var(--brand-primary); font-size: 14px; font-weight: 600; }
.topic-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 600px) { .recommendations { gap: 8px; } button { max-width: 180px; } }
</style>
