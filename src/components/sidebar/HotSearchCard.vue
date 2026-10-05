<template>
  <div class="sidebar-card">
    <div class="card-header">
      <h3 class="card-title">大家都在搜</h3>
      <button class="refresh-btn" title="换一换" @click="fetchKeywords">
        <i class="fas fa-sync-alt"></i>
        <span>换一换</span>
      </button>
    </div>
    <div v-if="loading" class="loading-wrapper">
      <LoadingState text="正在获取热搜" />
    </div>
    <div v-else-if="keywords.length === 0" class="empty-wrapper">
      <EmptyState title="暂无热搜" />
    </div>
    <div v-else class="hot-list">
      <button
        v-for="(keyword, index) in keywords.slice(0, 6)"
        :key="keyword"
        type="button"
        class="hot-item"
        :title="`搜索「${keyword}」`"
        @click="search(keyword)"
      >
        <span :class="['hot-rank', `rank-${index + 1}`]">{{ index + 1 }}</span>
        <span class="hot-keyword">{{ keyword }}</span>
        <span v-if="index === 0" class="hot-badge">热</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { extractHotSearchKeywords } from '../../utils/searchEntities';
import LoadingState from '../common/LoadingState.vue';
import EmptyState from '../common/EmptyState.vue';

const router = useRouter();
const keywords = ref<string[]>([]);
const loading = ref(false);

async function fetchKeywords() {
  loading.value = true;
  try {
    // getHotSearches(force) —— force=false 时走缓存，避免每次进首页都打一次接口
    const res = await CoolapkTauriAPI.getHotSearches(false);
    keywords.value = extractHotSearchKeywords(res);
  } catch (err) {
    console.error('Failed to fetch hot searches', err);
    keywords.value = [];
  } finally {
    loading.value = false;
  }
}

function search(keyword: string) {
  void router.push({ path: '/search', query: { q: keyword } });
}

onMounted(fetchKeywords);
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
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 0;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 12px;
  padding: 3px 0;
  border-radius: var(--radius-xs);
  cursor: pointer;
  transition: color var(--duration-fast) var(--ease-default);
}

.refresh-btn:hover {
  color: var(--brand-primary);
}

.loading-wrapper,
.empty-wrapper {
  padding: 12px 0;
}

.hot-list {
  display: flex;
  flex-direction: column;
}

.hot-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  padding: 4px 0;
  border: 0;
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;
  min-width: 0;
}

.hot-rank {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  color: var(--text-tertiary);
  font-size: 13px;
  font-weight: 700;
}

.rank-1 {
  color: #ff4757;
}

.rank-2 {
  color: #ffa502;
}

.rank-3 {
  color: #f5bd2e;
}

.hot-keyword {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 15px;
  line-height: 20px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hot-badge {
  flex: 0 0 auto;
  padding: 1px 5px;
  border-radius: var(--radius-xs);
  background: rgba(255, 71, 87, 0.12);
  color: #ff4757;
  font-size: 11px;
  font-weight: 600;
}

.hot-item:hover .hot-keyword {
  color: var(--brand-primary);
}

.hot-item:focus-visible {
  outline: 2px solid var(--brand-primary);
  outline-offset: -2px;
  border-radius: 4px;
}
</style>
