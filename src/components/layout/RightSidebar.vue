<template>
  <aside v-if="railVisible" class="right-sidebar custom-scrollbar">
    <!-- 2026-10-08：按用户要求，「我关注的话题」提到右栏最上面 -->
    <FollowedTopicsCard v-if="props.showFollowedTopics" />
    <WelcomeCard />
    <!--
      2026-10-08：去掉右栏的「大家都在搜」。同一批热门词现在只在
      点搜索框弹出的搜索页里展示（SearchCommand 的「热门搜索」区，12 条，比这里 6 条更全），
      右栏不再重复占位。原 HotSearchCard.vue 已删除（git 历史可查）。
    -->
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
  padding: 12px;
  flex-shrink: 0;
  box-sizing: border-box;
  background-color: var(--background-secondary);
}

@media (max-width: 1200px) {
  .right-sidebar {
    display: none !important;
  }
}
</style>
