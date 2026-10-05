<template>
  <div class="page-container custom-scrollbar" @scroll="handleScroll">
    <div v-if="!isDynamicPage" class="page-header page-data-header">
      <div class="header-titles">
        <h2 class="page-title"><i class="fas fa-list-ul icon"></i>{{ pageTitle }}</h2>
      </div>
    </div>

    <nav v-if="dynamicTabs.length" class="dynamic-tabs" aria-label="榜单分类">
      <button v-for="tab in dynamicTabs" :key="String(tab.url)" :class="{ active: selectedTabUrl === tab.url }" :disabled="loading || loadingMore" @click="selectDynamicTab(tab)">{{ tab.title }}</button>
    </nav>
    <template v-if="isDynamicPage">
      <div v-if="loading && dynamicItems.length === 0" class="state-wrapper">
        <FeedSkeleton :count="4" />
      </div>
      <div v-else-if="error && dynamicItems.length === 0" class="state-wrapper">
        <ErrorState title="加载页面内容失败" :message="error" @retry="loadCurrentPage(true)" />
      </div>
      <div v-else-if="dynamicItems.length === 0" class="state-wrapper">
        <EmptyState title="暂无内容" />
      </div>
      <div v-else :class="['feed-list', 'discovery-page-list', { 'topic-list-layout': isTopicListPage }]">
        <template v-for="(item, index) in dynamicItems" :key="getEntityKey(item, index)">
          <button v-if="dynamicTabs.length && item.entityType === 'product'" class="ranking-row" @click="openEntity(item)">
            <span class="ranking-number">{{ String(index + 1).padStart(2, '0') }}</span><AppImage :src="getEntityImage(item)" fit="contain" class="ranking-image" />
            <span class="ranking-copy"><strong>{{ getDigitalEntityTitle(item) }}</strong><small>{{ getDigitalProductHot(item) }}热度<span v-if="item.feed_comment_num"> · {{ item.feed_comment_num }}讨论</span></small></span>
          </button>
          <DiscoveryEntityCard v-else :entity="item" @open="openEntity" />
        </template>
        <div v-if="loadingMore" class="loading-more"><LoadingState text="加载更多..." /></div>
      </div>
    </template>
    <template v-else>
      <div v-if="loading && feeds.length === 0" class="state-wrapper">
        <FeedSkeleton :count="4" />
      </div>
      <div v-else-if="error && feeds.length === 0" class="state-wrapper">
        <ErrorState title="加载页面内容失败" :message="error" @retry="loadFeeds(true)" />
      </div>
      <div v-else-if="feeds.length === 0" class="state-wrapper">
        <EmptyState title="暂无内容" />
      </div>
      <div v-else class="feed-list">
        <FeedCard
          v-for="(item, index) in feeds"
          :key="item.id || index"
          :feed="item"
          @deleted="handleFeedDeleted"
        />
        <div v-if="loadingMore" class="loading-more"><LoadingState text="加载更多..." /></div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import DiscoveryEntityCard from '../components/discovery/DiscoveryEntityCard.vue';
import AppImage from '../components/common/AppImage.vue';
import { getEntityImage } from '../utils/discovery';
import { getDigitalEntityTitle, getDigitalProductHot } from '../utils/digitalProduct';
import FeedCard from '../components/feed/FeedCard.vue';
import FeedSkeleton from '../components/feed/FeedSkeleton.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import { useSettingsStore } from '../stores/settings';
import { hasFeedRenderableContent, shouldHideFeed } from '../utils/feedFilter';
import { decodeDiscoveryRouteSegment, getEntityKey, parseDiscoveryPage, resolveDiscoveryRoute } from '../utils/discovery';
import { normalizeCoolapkRoute } from '../utils/coolapkRoute';
import type { DiscoveryEntity } from '../types/discovery';

const route = useRoute();
const router = useRouter();
const settingsStore = useSettingsStore();
const pageUrl = computed(() => typeof route.query.url === 'string' ? route.query.url : '');
const pageTitle = computed(() => typeof route.query.title === 'string' && route.query.title.trim()
  ? route.query.title
  : '酷安内容');

const page = ref(1);
const feeds = ref<any[]>([]);
const dynamicItems = ref<DiscoveryEntity[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const noMore = ref(false);
const dynamicNoMore = ref(false);
const dynamicFirstItem = ref('');
const dynamicLastItem = ref('');
const error = ref('');
const dynamicTabs = ref<DiscoveryEntity[]>([]);
const selectedTabUrl = ref('');
function selectDynamicTab(tab: DiscoveryEntity) {
  if (loading.value || loadingMore.value || selectedTabUrl.value === tab.url) return;
  selectedTabUrl.value = String(tab.url || '');
  void loadDynamicPage(true);
}

function extractServerPageTarget(value: string): string {
  const raw = value.trim().replace(/^#/, '');
  const queryIndex = raw.indexOf('?');
  if (queryIndex < 0 || raw.slice(0, queryIndex).toLowerCase() !== '/page') return '';
  return new URLSearchParams(raw.slice(queryIndex + 1)).get('url')?.trim() || '';
}

const dynamicPageTarget = computed(() => extractServerPageTarget(pageUrl.value) || (route.query.renderer === 'discovery' ? pageUrl.value.trim() : ''));
const isDynamicPage = computed(() => Boolean(dynamicPageTarget.value) && (route.query.renderer === 'discovery' || Boolean(extractServerPageTarget(pageUrl.value))));
const isTopicListPage = computed(() => /^\/?topic\/tagList(?:\?|$)/i.test(dynamicPageTarget.value.trim().replace(/^#\/?/, '')));

function extractList(response: any): any[] {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

function handleFeedDeleted(id: string | number) {
  feeds.value = feeds.value.filter((feed) => String(feed.id) !== String(id));
}

async function loadFeeds(isRefresh = false) {
  if (!pageUrl.value || loading.value || (loadingMore.value && !isRefresh)) return;
  if (isRefresh) {
    page.value = 1;
    noMore.value = false;
    feeds.value = [];
    loading.value = true;
  } else {
    if (noMore.value) return;
    loadingMore.value = true;
  }
  error.value = '';

  try {
    const response = await CoolapkTauriAPI.getBoardFeeds(pageUrl.value, page.value);
    const nextFeeds = extractList(response)
      .filter((item) => hasFeedRenderableContent(item) && !shouldHideFeed(item, settingsStore.settings));
    if (nextFeeds.length < 3) noMore.value = true;

    if (isRefresh) {
      feeds.value = nextFeeds;
    } else {
      const existingIds = new Set(feeds.value.map((item) => item.id));
      feeds.value.push(...nextFeeds.filter((item) => !existingIds.has(item.id)));
    }
    page.value += 1;
  } catch (loadError: any) {
    error.value = loadError?.message || '加载失败，请检查网络';
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

async function loadDynamicPage(isRefresh = false) {
  if (!dynamicPageTarget.value || loading.value || (loadingMore.value && !isRefresh)) return;
  if (!isRefresh && dynamicNoMore.value) return;
  if (isRefresh) {
    page.value = 1;
    dynamicNoMore.value = false;
    dynamicFirstItem.value = '';
    dynamicLastItem.value = '';
    dynamicItems.value = [];
    loading.value = true;
  } else {
    loadingMore.value = true;
  }
  error.value = '';

  try {
    let response = await CoolapkTauriAPI.getDiscoveryPageData({ url: selectedTabUrl.value || dynamicPageTarget.value, title: pageTitle.value, page: page.value, firstItem: dynamicFirstItem.value, lastItem: dynamicLastItem.value, pageContext: JSON.stringify({ source: 'desktop-page-data-list', url: dynamicPageTarget.value }) });
    let parsed = parseDiscoveryPage(response, page.value);
    const tabs = parsed.items.find(item => String(item.entityTemplate).toLowerCase() === 'icontablinkgridcard');
    if (isRefresh && !selectedTabUrl.value && tabs?.entities?.length) {
      dynamicTabs.value = tabs.entities;
      selectedTabUrl.value = String(tabs.entities[0]!.url || '');
      response = await CoolapkTauriAPI.getDiscoveryPageData({ url: selectedTabUrl.value, title: pageTitle.value, page: 1, firstItem: '', lastItem: '', pageContext: '' });
      parsed = parseDiscoveryPage(response, 1);
    }
    const incoming = parsed.items;
    dynamicFirstItem.value = parsed.firstItem;
    dynamicLastItem.value = parsed.lastItem;
    dynamicNoMore.value = incoming.length === 0 || !parsed.hasMore;
    if (isRefresh) {
      dynamicItems.value = incoming;
    } else {
      const existingKeys = new Set(dynamicItems.value.map((item, index) => getEntityKey(item, index)));
      dynamicItems.value = [...dynamicItems.value, ...incoming.filter((item, index) => !existingKeys.has(getEntityKey(item, dynamicItems.value.length + index)))];
    }
    page.value += 1;
  } catch (loadError: any) {
    error.value = loadError?.message || '加载失败，请检查网络';
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

function loadCurrentPage(isRefresh = false) {
  if (isDynamicPage.value) void loadDynamicPage(isRefresh);
  else void loadFeeds(isRefresh);
}

function handleScroll(event: Event) {
  if (!isDynamicPage.value) return;
  const element = event.currentTarget as HTMLElement;
  if (element.scrollHeight - element.scrollTop - element.clientHeight < 480) void loadDynamicPage(false);
}

function navigateDataList(target: string, title: string) {
  void router.push({ path: '/page', query: { url: target, title, renderer: 'discovery' } });
}

function navigateNative(target: string, title: string) {
  const clean = target.replace(/^#/, '');
  const secondHand = clean.match(/^\/feed\/ershouList(?:\?|$)/i);
  const user = clean.match(/^\/user\/([^/?#]+)/);
  const feed = clean.match(/^\/feed\/([^/?#]+)/);
  const app = clean.match(/^\/apk\/([^/?#]+)/);
  const product = clean.match(/^\/product\/([^/?#]+)/);
  const topic = clean.match(/^\/topic\/([^/?#]+)/);
  const dyh = clean.match(/^\/dyh\/([^/?#]+)/);
  const live = clean.match(/^\/live\/([^/?#]+)/);
  if (secondHand) {
    const localRoute = normalizeCoolapkRoute(clean);
    if (localRoute) void router.push(localRoute);
    else navigateDataList(target, title);
  } else if (user) void router.push(`/user/${user[1]}`);
  else if (feed) void router.push(`/feed/${feed[1]}`);
  else if (app) void router.push(`/app/${encodeURIComponent(decodeDiscoveryRouteSegment(app[1]))}`);
  else if (product) void router.push(`/product/${product[1]}`);
  else if (topic) void router.push(`/topic/${encodeURIComponent(decodeDiscoveryRouteSegment(topic[1]))}`);
  else if (dyh) void router.push(`/dyh/${dyh[1]}`);
  else if (live && !/^detail$/i.test(live[1])) void router.push(`/live/${live[1]}`);
  else navigateDataList(target, title);
}

function openEntity(entity: DiscoveryEntity) {
  const routeInfo = resolveDiscoveryRoute(entity);
  if (!routeInfo) return;
  if (routeInfo.kind === 'web') void CoolapkTauriAPI.openUrl(routeInfo.target, 'internal');
  else if (routeInfo.kind === 'native') navigateNative(routeInfo.target, routeInfo.title || String(entity.title || ''));
  else navigateDataList(routeInfo.target, routeInfo.title || String(entity.title || ''));
}

watch([pageUrl, dynamicPageTarget, isDynamicPage], () => { dynamicTabs.value = []; selectedTabUrl.value = ''; loadCurrentPage(true); });
onMounted(() => { loadCurrentPage(true); });
</script>

<style scoped>
.dynamic-tabs { position: sticky; top: 0; z-index: 2; display: flex; overflow-x: auto; scrollbar-width: none; background: var(--surface); border-bottom: 1px solid var(--border-light); }
.dynamic-tabs button { flex-shrink: 0; padding: 14px; border: 0; background: transparent; color: var(--text-secondary); font: inherit; }
.dynamic-tabs button.active { color: var(--brand-primary); font-weight: 700; box-shadow: inset 0 -3px var(--brand-primary); }
.ranking-row { display: flex; align-items: center; gap: 12px; width: 100%; min-width: 0; min-height: 100px; padding: 14px; border: 0; border-bottom: 1px solid var(--border-light); background: var(--surface); color: var(--text-primary); text-align: left; }
.ranking-number { flex: 0 0 24px; font-size: 15px; color: var(--text-secondary); }
.ranking-image { width: 54px; height: 60px; flex: 0 0 54px; }
.ranking-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
.ranking-copy strong { font-size: 16px; overflow-wrap: anywhere; }
.ranking-copy small { color: var(--text-secondary); font-size: 12px; }
.page-container { width: 100%; max-width: 100%; flex: 1 1 auto; min-width: 0; height: 100%; min-height: 0; box-sizing: border-box; overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; }
.page-data-header { display: flex; align-items: center; padding-bottom: 18px; }
.loading-more { padding: 16px; text-align: center; }
.discovery-page-list.topic-list-layout { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; align-content: start; padding: 16px; }
.discovery-page-list.topic-list-layout > .loading-more { grid-column: 1 / -1; }

@media (max-width: 720px) {
  .discovery-page-list.topic-list-layout {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    padding: 12px;
  }

  .topic-list-layout :deep(.topic-card.mode-card) {
    padding: 12px 6px;
    border-radius: 12px;
  }

  .topic-list-layout :deep(.topic-card.mode-card .topic-icon-wrapper) {
    width: 48px;
    height: 48px;
    margin-bottom: 8px;
    border-radius: 12px;
  }

  .topic-list-layout :deep(.topic-card.mode-card .topic-title) {
    font-size: 12px;
  }

  .topic-list-layout :deep(.topic-card.mode-card .topic-stats) {
    display: -webkit-box;
    overflow: hidden;
    white-space: normal;
    text-overflow: ellipsis;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-height: 1.25;
    font-size: 10px;
  }
}
</style>
