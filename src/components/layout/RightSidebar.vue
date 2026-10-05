<template>
  <aside v-if="railVisible" class="right-sidebar custom-scrollbar">
    <WelcomeCard />
    <FollowedTopicsCard v-if="props.showFollowedTopics" />
    <TrendingList v-if="props.showMonthlyRank" />
    <HotTopicList v-if="props.showHotTopics" />
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import TrendingList from '../sidebar/TrendingList.vue';
import HotTopicList from '../sidebar/HotTopicList.vue';
import FollowedTopicsCard from '../sidebar/FollowedTopicsCard.vue';
import WelcomeCard from '../sidebar/WelcomeCard.vue';
import { useSettingsStore } from '../../stores/settings';

const props = withDefaults(defineProps<{
  showMonthlyRank?: boolean;
  showHotTopics?: boolean;
  showFollowedTopics?: boolean;
}>(), {
  showMonthlyRank: true,
  showHotTopics: true,
  showFollowedTopics: true,
});

const settingsStore = useSettingsStore();

// 顶栏「隐藏右栏」开关优先于各卡片自己的显示设置。
const railVisible = computed(() => !settingsStore.settings.hideHomeRightSidebar
  && (props.showMonthlyRank || props.showHotTopics || props.showFollowedTopics));
</script>

<style scoped>
.right-sidebar {
  width: clamp(var(--right-sidebar-width, 280px), 19vw, 320px);
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0;
  flex-shrink: 0;
  box-sizing: border-box;
  background-color: var(--background-secondary);
}

.right-sidebar :deep(.sidebar-card) {
  margin: 0;
  padding: 16px;
  border: 0;
  border-bottom: 1px solid var(--border);
  border-radius: 0;
}

@media (max-width: 1200px) {
  .right-sidebar {
    display: none !important;
  }
}
</style>
