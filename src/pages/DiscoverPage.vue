<template>
  <div :class="['discover-page', { 'is-cool-picture': isCoolPicturePage }]">
    <div class="discover-main-column">
      <div class="discover-toolbar-row">
        <FeedTabs v-if="tabs.length" :active-key="selectedKey" :tabs="feedTabs" :show-manage="false" @update:active-key="selectTab" />
      </div>

      <div class="discover-scroll-container custom-scrollbar" @scroll.passive="handleScroll">
        <div v-if="configError && !tabs.length" class="config-error">
          <strong>发现频道配置加载失败</strong>
          <span>{{ configError }}</span>
          <button type="button" @click="loadConfig">重试</button>
        </div>

        <section v-if="currentState.webUrl" class="web-route-card">
          <i class="fas fa-globe"></i>
          <div>
            <strong>该栏目由网页内容提供</strong>
            <span>{{ currentState.webUrl }}</span>
          </div>
          <button type="button" @click="openWeb(currentState.webUrl)">打开页面</button>
        </section>

        <!-- 加载中状态：渲染与真实发现页 1:1 对齐的高保真流光骨架屏 -->
        <DiscoverySkeleton v-else-if="isPageLoading && !currentState.items.length" />

        <!-- 错误状态：居中提示并提供重试按钮 -->
        <div v-else-if="currentState.error && !currentState.items.length" class="state-container">
          <ErrorState title="发现内容加载失败" :message="currentState.error" @retry="refresh" />
        </div>

        <!-- 空内容状态：居中提示 -->
        <div v-else-if="!currentState.items.length && !isPageLoading" class="state-container">
          <EmptyState title="暂无发现内容" description="服务端暂时没有返回可展示的内容" />
        </div>

        <!-- 发现内容数据流 -->
        <section v-else :class="['discover-content', { 'has-goods-grid': isGoodsPage, 'has-dyh-grid': isDyhPage, 'is-cool-picture': isCoolPicturePage }]">
          <DiscoveryEntityCard
            v-for="(entity, index) in currentState.items"
            :key="getEntityKey(entity, index)"
            :entity="entity"
            :plain-topic-labels="isCoolPicturePage"
            @open="openEntity"
          />
          <div v-if="currentState.loading" class="loading-more"><LoadingState text="正在加载更多..." /></div>
          <div v-else-if="!currentState.hasMore" class="no-more">没有更多内容了</div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import DiscoveryEntityCard from '../components/discovery/DiscoveryEntityCard.vue';
import DiscoverySkeleton from '../components/discovery/DiscoverySkeleton.vue';
import FeedTabs from '../components/feed/FeedTabs.vue';
import EmptyState from '../components/common/EmptyState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import LoadingState from '../components/common/LoadingState.vue';
import type { ConfigPageTab } from '../types/settings';
import type { DiscoveryEntity, DiscoveryPageResult, DiscoveryTab } from '../types/discovery';
import {
  decodeDiscoveryRouteSegment,
  getEntityKey,
  isGoodsEntity,
  normalizeDiscoveryPageUrl,
  parseDiscoveryPage,
  parseDiscoverySelectedKey,
  parseDiscoveryTabs,
  resolveDiscoveryRoute,
  resolveDiscoveryTopicRoute,
} from '../utils/discovery';

interface PageState extends DiscoveryPageResult {
  loading: boolean;
  error: string;
  webUrl: string;
}

const router = useRouter();
const tabs = ref<DiscoveryTab[]>([]);
const selectedKey = ref('');
const configLoading = ref(true);
const configError = ref('');
const states = reactive<Record<string, PageState>>({});
const feedTabs = computed<ConfigPageTab[]>(() => tabs.value.map((tab) => ({ id: tab.key, title: tab.title, page_name: tab.key, url: tab.url, subTitle: tab.subTitle })));
const selectedTabStorageKey = 'coolapk.discovery.selectedTab.v3';

const fallbackTabs: DiscoveryTab[] = [
  fallbackTab('发现', '#/feed/digestList'),
  fallbackTab('最新', '#/feed/newestList'),
  fallbackTab('酷图', 'V11_FIND_COOLPIC'),
  fallbackTab('应用', '#/apk/list'),
  fallbackTab('看看号', '/user/dyhSubscribe'),
];

// 初始化优先读取本地缓存，避免首屏瞬间无 Tab 和闪烁
try {
  const cached = JSON.parse(localStorage.getItem('coolapk.discovery.tabs.v2') || '[]');
  if (Array.isArray(cached) && cached.length) {
    tabs.value = cached;
    const savedSelected = localStorage.getItem(selectedTabStorageKey);
    selectedKey.value = tabs.value.some((tab) => tab.key === savedSelected)
      ? String(savedSelected)
      : tabs.value.find((tab) => tab.title.trim() === '生活')?.key || tabs.value[0]?.key || '';
  }
} catch {
  tabs.value = fallbackTabs;
  selectedKey.value = fallbackTabs[0]?.key || '';
}

const selectedTab = computed(() => tabs.value.find((tab) => tab.key === selectedKey.value));
const isCoolPicturePage = computed(() => selectedTab.value?.pageName === 'V11_FIND_COOLPIC' || selectedTab.value?.url === 'V11_FIND_COOLPIC' || selectedTab.value?.title?.trim() === '酷图');
const currentState = computed<PageState>(() => {
  if (!selectedKey.value || !states[selectedKey.value]) return emptyState(false);
  return states[selectedKey.value];
});
const isPageLoading = computed(() => {
  if (configLoading.value && !tabs.value.length) return true;
  if (!selectedTab.value) return true;
  return currentState.value.loading;
});
const isGoodsPage = computed(() => {
  const tab = selectedTab.value;
  if (tab?.nativeKind === 'goods' || tab?.pageName === 'V11_FIND_GOOD_GOODS_HOME') return true;
  return currentState.value.items.length > 1 && currentState.value.items.every(isGoodsEntity);
});
const isDyhPage = computed(() => {
  const tab = selectedTab.value;
  if (tab?.nativeKind === 'dyh' || tab?.pageName === 'V11_FIND_DYH' || tab?.title?.includes('看看号')) return true;
  return currentState.value.items.length > 0 && currentState.value.items.every((item) => {
    const type = String(item.entityType || item.entityTemplate || '').toLowerCase();
    return type.includes('dyh') || type.includes('official');
  });
});

function fallbackTab(title: string, url: string): DiscoveryTab {
  return { key: url, title, url, visible: true, order: 0, raw: { title, url } };
}

function emptyState(loading = false): PageState {
  return { items: [], page: 1, hasMore: true, firstItem: '', lastItem: '', raw: null, loading, error: '', webUrl: '' };
}

function ensureState(tab: DiscoveryTab): PageState {
  if (!states[tab.key]) states[tab.key] = emptyState(false);
  return states[tab.key];
}

async function loadConfig() {
  configLoading.value = true;
  configError.value = '';
  try {
    const response = await CoolapkTauriAPI.getDiscoveryConfig();
    const parsed = parseDiscoveryTabs(response);
    if (parsed.length) {
      tabs.value = parsed;
      localStorage.setItem('coolapk.discovery.tabs.v2', JSON.stringify(parsed));
    }
    const serverSelected = parseDiscoverySelectedKey(response, tabs.value);
    const savedSelected = localStorage.getItem(selectedTabStorageKey);
    if (!selectedKey.value || !tabs.value.some((t) => t.key === selectedKey.value)) {
      selectedKey.value = tabs.value.some((tab) => tab.key === savedSelected)
        ? String(savedSelected)
        : tabs.value.find((tab) => tab.title.trim() === '生活')?.key || serverSelected || tabs.value[0]?.key || '';
    }
  } catch (error: any) {
    configError.value = error?.message || '无法获取服务端发现配置';
  } finally {
    configLoading.value = false;
    if (!selectedKey.value && tabs.value.length) {
      selectedKey.value = tabs.value[0].key;
    }
    // 旧版保存的话题选中项不再作为发现页内容加载，恢复到可在页内浏览的频道。
    if (selectedTab.value && resolveDiscoveryTopicRoute(selectedTab.value.url || selectedTab.value.pageName || selectedTab.value.key)) {
      const inPageTab = tabs.value.find((tab) => tab.title.trim() === '生活' && !resolveDiscoveryTopicRoute(tab.url || tab.pageName || tab.key)) || tabs.value.find((tab) => !resolveDiscoveryTopicRoute(tab.url || tab.pageName || tab.key));
      if (inPageTab) selectedKey.value = inPageTab.key;
    }
    if (selectedKey.value) localStorage.setItem(selectedTabStorageKey, selectedKey.value);
    void loadSelected(false);
  }
}

async function loadSelected(reset = false) {
  const tab = selectedTab.value;
  if (!tab) return;
  const state = ensureState(tab);
  const target = tab.webUrl || tab.raw.webUrl || tab.raw.web_url || tab.url;
  if (/^https?:\/\//i.test(String(target))) {
    state.webUrl = String(target);
    state.loading = false;
    return;
  }
  if (state.loading && !reset) return;
  if (!reset && state.items.length > 0) return;
  if (!reset && !state.hasMore) return;

  if (reset) {
    state.items = [];
    state.page = 1;
    state.hasMore = true;
    state.firstItem = '';
    state.lastItem = '';
    state.raw = null;
    state.error = '';
  }
  state.loading = true;
  state.error = '';
  try {
    const response = tab.nativeKind === 'dyh'
      ? await CoolapkTauriAPI.getDyhList(state.page)
      : await CoolapkTauriAPI.getDiscoveryPageData({
        url: normalizeDiscoveryPageUrl(tab.url || tab.pageName || tab.key),
        title: tab.title,
        subTitle: tab.subTitle,
        page: state.page,
        firstItem: state.firstItem,
        lastItem: state.lastItem,
        pageContext: JSON.stringify({ source: 'desktop-discovery', tab: tab.key }),
      });
    const parsed = parseDiscoveryPage(response, state.page);
    const known = new Set(state.items.map((item) => getEntityKey(item, 0)));
    const nextItems = parsed.items.filter((item, index) => !known.has(getEntityKey(item, index)));
    state.items.push(...nextItems);
    state.raw = parsed.raw;
    state.firstItem = parsed.firstItem;
    state.lastItem = parsed.lastItem;
    state.hasMore = parsed.hasMore && nextItems.length > 0;
    state.page += 1;
  } catch (error: any) {
    const detail = error?.message || String(error || '未知错误');
    state.error = `${tab.title}（${tab.url || tab.pageName || tab.key}）：${detail}`;
  } finally {
    state.loading = false;
  }
}

function selectTab(key: string) {
  const tab = tabs.value.find((item) => item.key === key);
  if (!tab) return;
  const topicRoute = resolveDiscoveryTopicRoute(tab.url || tab.pageName || tab.key);
  if (topicRoute) {
    navigateNative(topicRoute, tab.title);
    return;
  }
  selectedKey.value = key;
  localStorage.setItem(selectedTabStorageKey, key);
  if (tab.openNewActivity && tab.nativeKind !== 'dyh') {
    openTab(tab);
    return;
  }
  void loadSelected(false);
}

function openTab(tab: DiscoveryTab) {
  if (tab.nativeKind === 'dyh') {
    selectedKey.value = tab.key;
    void loadSelected(true);
    return;
  }
  const route = resolveDiscoveryRoute(tab.raw);
  if (!route) return;
  if (route.kind === 'web') {
    openWeb(route.target);
    return;
  }
  if (route.kind === 'native') {
    navigateNative(route.target, tab.title);
    return;
  }
  navigateDataList(tab.url || tab.pageName || tab.key, tab.title);
}

function openEntity(entity: DiscoveryEntity) {
  const route = resolveDiscoveryRoute(entity);
  if (!route) return;
  if (route.kind === 'web') {
    openWeb(route.target);
  } else if (route.kind === 'native') {
    navigateNative(route.target, route.title || String(entity.title || ''));
  } else {
    navigateDataList(route.target, route.title || String(entity.title || ''));
  }
}

function navigateDataList(target: string, title: string) {
  // 点击发现卡片时使用应用级页面标签，不向发现频道栏追加临时标签。
  void router.push({ path: '/page', query: { url: normalizeDiscoveryPageUrl(target), title: title || '内容', renderer: 'discovery' } });
}

function navigateNative(target: string, title: string) {
  const clean = target.replace(/^#/, '');
  const user = clean.match(/^\/user\/(\d+)/);
  const feed = clean.match(/^\/feed\/(\d+)/);
  const app = clean.match(/^\/apk\/([^/?#]+)/);
  const product = clean.match(/^\/product\/(\d+)/);
  const topic = clean.match(/^\/topic\/([^/?#]+)(?:\?([^#]*))?/);
  const dyh = clean.match(/^\/dyh\/(\d+)/);
  if (user) void router.push(`/user/${user[1]}`);
  else if (feed) void router.push(`/feed/${feed[1]}`);
  else if (app) void router.push(`/app/${encodeURIComponent(decodeDiscoveryRouteSegment(app[1]))}`);
  else if (product) void router.push(`/product/${product[1]}`);
  else if (topic) void router.push(`/topic/${encodeURIComponent(decodeDiscoveryRouteSegment(topic[1]))}${topic[2] ? `?${topic[2]}` : ''}`);
  else if (dyh) void router.push(`/dyh/${dyh[1]}`);
  else navigateDataList(target, title);
}

function openWeb(url: string) {
  void CoolapkTauriAPI.openUrl(url, 'internal');
}

function refresh() {
  if (selectedTab.value) void loadSelected(true);
  else void loadConfig();
}

function handleScroll(event: Event) {
  const element = event.currentTarget as HTMLElement;
  if (element.scrollHeight - element.scrollTop - element.clientHeight < 500) {
    void loadSelected(false);
  }
}

onMounted(() => { void loadConfig(); });
</script>

<style scoped>
.discover-page { display: flex; width: 100%; height: 100%; min-width: 0; min-height: 0; overflow: hidden; background: var(--background); }
.discover-main-column { display: flex; flex: 1; flex-direction: column; width: 100%; height: 100%; min-width: 0; min-height: 0; overflow: hidden; background: var(--surface); }
.discover-toolbar-row { display: flex; flex: 0 0 auto; align-items: stretch; min-width: 0; background: var(--surface); }
.discover-toolbar-row :deep(.feed-tabs-wrapper) { flex: 1 1 auto; min-width: 0; }
.discover-scroll-container { flex: 1; min-width: 0; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 16px 0 48px; background: var(--background-secondary); }
.web-route-card, .config-error { max-width: none; width: 100%; margin: 0 0 16px; background: var(--surface); border: 1px solid var(--border-light, rgba(0,0,0,.08)); border-radius: var(--radius-card, 12px); box-sizing: border-box; }
.web-route-card, .config-error { display: flex; align-items: center; gap: 14px; padding: 18px; }
.web-route-card > i { color: var(--brand-primary); font-size: 24px; }
.web-route-card div, .config-error { min-width: 0; }
.web-route-card div { display: flex; flex-direction: column; gap: 5px; flex: 1; }
.web-route-card span, .config-error span { color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.web-route-card button, .config-error button { border: 0; border-radius: 8px; padding: 8px 16px; background: var(--brand-primary); color: white; cursor: pointer; font-weight: 500; }
.config-error { flex-wrap: wrap; color: var(--text-primary); }
.config-error span { flex: 1 1 100%; }
.state-container { max-width: none; width: 100%; margin: 30px 0 0; min-height: 360px; display: flex; justify-content: center; align-items: center; }
.discover-content { max-width: none; width: 100%; margin: 0; display: grid; gap: 16px; }
.discover-content.is-cool-picture, .is-cool-picture .discover-scroll-container > :deep(.discovery-skeleton) { box-sizing: border-box; width: 100%; padding-inline: 0; }
.discover-content.is-cool-picture { gap: 14px; }
/* 酷图页使用独立圆角卡片，末行卡片也伸展填满可用宽度。 */
.discover-content.is-cool-picture :deep(.discovery-entity-group.is-picture-topic-grid) { overflow: visible; border: 0; background: transparent; }
.discover-content.is-cool-picture :deep(.discovery-entity-group.is-picture-topic-grid .discovery-group-items) { display: flex; flex-wrap: wrap; gap: 12px; padding: 0; }
.discover-content.is-cool-picture :deep(.discovery-entity-group.is-picture-topic-grid .discovery-group-items > *) { flex: 1 1 220px; min-width: 0; }
.discover-content.is-cool-picture :deep(.discovery-entity-group.is-picture-topic-grid .topic-card.mode-card) { box-sizing: border-box; min-height: 144px; justify-content: center; }
.discover-content.is-cool-picture :deep(.discovery-icon-grid) { padding-bottom: 0; border: 0; background: transparent; }
.discover-content.is-cool-picture :deep(.discovery-icon-grid-items.is-category-grid) { display: flex; flex-wrap: wrap; gap: 12px; padding: 0; }
.discover-content.is-cool-picture :deep(.discovery-icon-grid-item.is-category-item) { flex: 1 1 150px; min-width: 0; min-height: 112px; gap: 8px; padding: 12px 8px; border: 1px solid var(--border-light, rgba(0, 0, 0, .08)); border-radius: var(--radius-card, 16px); background: var(--surface); }
.discover-content.is-cool-picture :deep(.discovery-icon-grid-item.is-category-item:hover) { border-color: var(--brand-primary); background: var(--surface-hover); box-shadow: 0 6px 18px rgba(0, 0, 0, .06); }
.discover-content.is-cool-picture :deep(.discovery-icon-grid-item.is-category-item .discovery-icon-inner) { width: 48px; height: 48px; }
.discover-content.is-cool-picture :deep(.discovery-icon-grid-item.is-category-item .discovery-icon-grid-image img) { width: 48px; height: 48px; max-width: 48px; max-height: 48px; }
.discover-content.has-goods-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); align-items: stretch; }
.discover-content.has-dyh-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.loading-more, .no-more { padding: 16px; text-align: center; color: var(--text-tertiary); font-size: 13px; }
@media (max-width: 1250px) {
  .discover-content.has-goods-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 860px) {
  .discover-scroll-container { padding-top: 12px; padding-bottom: max(48px, var(--mobile-bottom-overlay-space, 0px)); }
  .discover-content.has-dyh-grid { grid-template-columns: 1fr; }
  .discover-content.has-goods-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
