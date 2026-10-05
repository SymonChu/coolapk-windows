<template>
  <div ref="pageContainerRef" class="page-container custom-scrollbar" @scroll="handleScroll">
    <div class="page-header">
      <div class="header-main">
        <button type="button" class="back-button" @click="goBack">
          <i class="fas fa-arrow-left"></i>
          <span>二手市场</span>
        </button>
        <span class="page-subtitle">{{ listTitle }}</span>
      </div>
      <span class="route-hint"><i class="fas fa-tags"></i> APK 闲置型号列表</span>
    </div>

    <div v-if="loading && items.length === 0" class="state-wrapper">
      <DiscoverySkeleton />
    </div>
    <div v-else-if="error && items.length === 0" class="state-wrapper">
      <ErrorState title="闲置列表加载失败" :message="error" @retry="reload" />
    </div>
    <div v-else-if="items.length === 0" class="state-wrapper">
      <EmptyState title="暂无闲置内容" description="这个型号暂时没有可展示的闲置动态" />
    </div>
    <div v-else class="feed-list discovery-page-list">
      <DiscoveryEntityCard v-for="(item, index) in items" :key="getEntityKey(item, index)" :entity="item" @open="openEntity" />
      <div class="pagination-footer">
        <LoadingState v-if="loadingMore" text="正在加载更多闲置内容..." />
        <button v-else-if="error" type="button" class="retry-inline" @click="loadPage(true)">加载失败，点击重试</button>
        <span v-else-if="noMore" class="no-more">没有更多闲置内容了</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import DiscoveryEntityCard from '../components/discovery/DiscoveryEntityCard.vue';
import DiscoverySkeleton from '../components/discovery/DiscoverySkeleton.vue';
import LoadingState from '../components/common/LoadingState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import { getEntityKey, parseDiscoveryPage, resolveDiscoveryRoute } from '../utils/discovery';
import { normalizeCoolapkRoute } from '../utils/coolapkRoute';
import { secondHandListCache } from '../utils/secondHandCache';
import type { DiscoveryEntity } from '../types/discovery';

const route = useRoute();
const router = useRouter();
const SECOND_HAND_ROUTE = '/feed/ershouList';
const SECOND_HAND_QUERY_KEYS = ['brand', 'productId', 'cityId', 'ershouType', 'dataListType'] as const;

const page = ref(1);
const items = ref<DiscoveryEntity[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const noMore = ref(false);
const firstItem = ref('');
const lastItem = ref('');
const pageContext = ref('');
const error = ref('');
const pageContainerRef = ref<HTMLElement | null>(null);
const scrollTop = ref(0);
let requestVersion = 0;

function queryValue(key: string): string {
  const value = route.query[key];
  if (Array.isArray(value)) return String(value[0] || '');
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

const listTarget = computed(() => {
  const params = new URLSearchParams();
  for (const key of SECOND_HAND_QUERY_KEYS) {
    const value = queryValue(key);
    if (value || key === 'dataListType') params.set(key, value || 'staggered');
  }
  return `${SECOND_HAND_ROUTE}?${params.toString()}`;
});

const listTitle = computed(() => queryValue('productId') ? `闲置交易 · 型号 ${queryValue('productId')}` : '闲置交易');

const listCacheKey = computed(() => listTarget.value);

function syncCache() {
  secondHandListCache.set(listCacheKey.value, { initialized: true, items: [...items.value], page: page.value, firstItem: firstItem.value, lastItem: lastItem.value, pageContext: pageContext.value, noMore: noMore.value, scrollTop: scrollTop.value });
}

function restoreCachedState(): boolean {
  const cached = secondHandListCache.get(listCacheKey.value);
  if (!cached?.initialized) return false;
  page.value = cached.page;
  items.value = [...cached.items];
  noMore.value = cached.noMore;
  firstItem.value = cached.firstItem;
  lastItem.value = cached.lastItem;
  pageContext.value = cached.pageContext;
  scrollTop.value = cached.scrollTop;
  error.value = '';
  void restoreScrollPosition();
  return true;
}

async function restoreScrollPosition() {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  if (pageContainerRef.value) pageContainerRef.value.scrollTop = scrollTop.value;
}

function resetState() {
  requestVersion += 1;
  secondHandListCache.delete(listCacheKey.value);
  page.value = 1;
  items.value = [];
  noMore.value = false;
  firstItem.value = '';
  lastItem.value = '';
  pageContext.value = '';
  error.value = '';
  scrollTop.value = 0;
}

function appendItems(incoming: DiscoveryEntity[]) {
  const existingKeys = new Set(items.value.map((item, index) => getEntityKey(item, index)));
  items.value = [...items.value, ...incoming.filter((item, index) => !existingKeys.has(getEntityKey(item, items.value.length + index)))];
}

async function loadPage(isLoadMore = false) {
  if (isLoadMore && (loading.value || loadingMore.value || noMore.value)) return;
  if (isLoadMore) loadingMore.value = true;
  else loading.value = true;
  error.value = '';
  const currentVersion = ++requestVersion;
  const currentPage = page.value;
  try {
    const response = await CoolapkTauriAPI.getDiscoveryPageData({ url: `#${listTarget.value}`, title: listTitle.value, page: currentPage, firstItem: firstItem.value, lastItem: lastItem.value, pageContext: pageContext.value || JSON.stringify({ source: 'desktop-secondhand-list', target: listTarget.value }) });
    if (currentVersion !== requestVersion) return;
    const parsed = parseDiscoveryPage(response, currentPage);
    if (isLoadMore) appendItems(parsed.items);
    else items.value = parsed.items;
    firstItem.value = parsed.firstItem;
    lastItem.value = parsed.lastItem;
    pageContext.value = parsed.pageContext || pageContext.value;
    noMore.value = parsed.items.length === 0 || !parsed.hasMore;
    page.value += 1;
    syncCache();
  } catch (loadError: any) {
    if (currentVersion === requestVersion) error.value = loadError?.message || '加载失败，请检查网络';
  } finally {
    if (currentVersion === requestVersion) {
      loading.value = false;
      loadingMore.value = false;
    }
  }
}

function reload() {
  resetState();
  void loadPage(false);
}

function handleRouteChange() {
  if (route.path !== '/secondhand/list') return;
  if (restoreCachedState()) return;
  reload();
}

function goBack() {
  void router.push('/secondhand');
}

function openEntity(entity: DiscoveryEntity) {
  const routeInfo = resolveDiscoveryRoute(entity);
  if (!routeInfo) return;
  if (routeInfo.kind === 'web') {
    void CoolapkTauriAPI.openUrl(routeInfo.target, 'internal');
    return;
  }
  const localRoute = normalizeCoolapkRoute(routeInfo.target);
  if (localRoute && router.resolve(localRoute).matched.length > 0) {
    void router.push(localRoute);
    return;
  }
  void router.push({ path: '/page', query: { url: routeInfo.target, title: routeInfo.title || String(entity.title || ''), renderer: 'discovery' } });
}

function handleScroll(event: Event) {
  const element = event.currentTarget as HTMLElement;
  scrollTop.value = element.scrollTop;
  syncCache();
  if (element.scrollHeight - element.scrollTop - element.clientHeight < 360) void loadPage(true);
}

watch(() => route.fullPath, handleRouteChange, { immediate: true });
</script>

<style scoped>
.page-container { width: 100%; max-width: var(--feed-max-width, 860px); height: 100%; overflow-y: auto; padding: 14px 16px; margin: 0 auto; box-sizing: border-box; }
.page-header { margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.header-main { display: flex; align-items: baseline; gap: 12px; min-width: 0; }
.back-button { display: inline-flex; align-items: center; gap: 8px; border: 0; background: transparent; color: var(--text-primary); font: inherit; font-size: 18px; font-weight: 800; cursor: pointer; padding: 0; }
.back-button i { color: var(--brand-primary); font-size: 15px; }
.page-subtitle, .route-hint { color: var(--text-tertiary); font-size: 12px; }
.route-hint { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.route-hint i { color: var(--brand-primary); }
.state-wrapper { padding: 18px 0; }
.feed-list { display: flex; flex-direction: column; gap: 12px; }
.pagination-footer { padding: 16px 0; text-align: center; }
.no-more { color: var(--text-tertiary); font-size: 12px; }
.retry-inline { border: 0; background: transparent; color: var(--brand-primary, #10b981); font-size: 12px; cursor: pointer; }
</style>
