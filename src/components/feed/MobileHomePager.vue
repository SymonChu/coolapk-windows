<template>
  <div class="mobile-home-pager" :class="{ 'desktop-home-pager': !mobile }">
    <div class="home-main-column">
    <div v-if="!mobile" class="pager-home-header">
      <div class="pager-home-crumb">
        <span class="crumb-back">←</span>
        <span class="crumb-parent">社区</span>
        <i class="crumb-sep">/</i>
        <b class="crumb-current">首页</b>
      </div>
      <h1 class="pager-home-title">
        首页<span class="pager-home-sub">数码与生活，都有酷友的声音。</span>
      </h1>
    </div>
    <div class="home-toolbar">
    <FeedTabs :active-key="activeKey" :tabs="tabs" :manager-tabs="serverTabs" :swipe-progress="position" :active-sub-tab-key="activePanel?.activeFollowSubChannelKey || ''" :wrap="!mobile" @update:active-key="select" @select-sub-tab="selectSubTab" />
    <FeedLayoutToggle v-if="!mobile" v-model="settings.settings.feedLayout" />
    </div>
    <!-- 快捷入口行放在栏目行之后（界面稿的顺序：大标题 → 栏目行 → 快捷入口） -->
    <div v-if="!mobile && hotKeywords.length" class="pager-home-quick custom-scrollbar">
      <button
        v-for="kw in hotKeywords"
        :key="kw"
        type="button"
        class="pager-home-chip"
        @click="searchKeyword(kw)"
      ><b>#</b>{{ kw }}</button>
    </div>
    <div v-if="error" class="pager-state"><p>{{ error }}</p><button type="button" @click="loadTabs">重试</button></div>
    <div v-else-if="!tabs.length" class="pager-state">正在加载栏目…</div>
    <div v-else ref="viewport" class="pager-viewport" @pointerdown="startDrag" @click.capture="blockSwipeClick" @wheel="wheel">
      <div class="pager-track" :style="{ transform: `translate3d(${-position * width}px,0,0)` }">
        <section v-for="(tab, index) in tabs" :key="getHomeTabKey(tab)" class="pager-page" :style="{ left: `${index * 100}%` }" :inert="index !== activeIndex" :aria-hidden="index !== activeIndex" :data-tab-key="getHomeTabKey(tab)">
          <HomeTabPanel v-if="visited.has(getHomeTabKey(tab)) || index === activeIndex || (mobile && Math.abs(index - activeIndex) <= 1)" :ref="el => setPanel(getHomeTabKey(tab), el)" embedded :tab-key="getHomeTabKey(tab)" :tabs="serverTabs" :selected="index === activeIndex" />
        </section>
      </div>
    </div>
    </div>
    <RightSidebar v-if="sidebarMounted" v-show="!mobile" :show-monthly-rank="settings.settings.showHomeMonthlyRank" :show-hot-topics="settings.settings.showHomeHotTopics" :show-followed-topics="settings.settings.showHomeFollowedTopics" />
  </div>
</template>
<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, onActivated, onDeactivated, provide, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import FeedTabs from './FeedTabs.vue';
import FeedLayoutToggle from './FeedLayoutToggle.vue';
import RightSidebar from '../layout/RightSidebar.vue';
import HomeTabPanel from '../../pages/HomeTabPanel.vue';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { extractHotSearchKeywords } from '../../utils/searchEntities';
import { useSettingsStore } from '../../stores/settings';
import { getHomeTabKey, resolvePreferredHomeTab, type HomeSubChannelSelection } from '../../utils/homeTabs';
import type { ConfigPageTab } from '../../types/settings';
import { homePagerMovingKey } from '../../utils/feedPageVisibility';

const props = withDefaults(defineProps<{ mobile?: boolean }>(), { mobile: true });
const sidebarMounted = ref(!props.mobile);
const settings = useSettingsStore();
const router = useRouter();
/** 桌面首页头部的热词胶囊（照界面稿），手机端不显示。 */
const hotKeywords = ref<string[]>([]);
async function loadHotKeywords() {
  if (props.mobile) return;
  try {
    const response = await CoolapkTauriAPI.getHotSearches(false);
    hotKeywords.value = extractHotSearchKeywords(response).slice(0, 6);
  } catch (err) {
    console.warn('加载首页热词失败', err);
  }
}
function searchKeyword(keyword: string) {
  void router.push({ path: '/search', query: { q: keyword } });
}
const serverTabs = ref<ConfigPageTab[]>([]), activeKey = ref(''), error = ref('');
const position = ref(0), width = ref(1), viewport = ref<HTMLElement | null>(null);
const moving = ref(false);
provide(homePagerMovingKey, moving);
const visited = reactive(new Set<string>());
type Panel = { activeFollowSubChannelKey: string; handleHomeSubChannelSelected: (selection: HomeSubChannelSelection) => void };
const panels = reactive(new Map<string, Panel>());
const activePanel = computed(() => panels.get(activeKey.value));
function setPanel(key: string, el: unknown) {
  if (el) { panels.set(key, el as Panel); visited.add(key); }
  else panels.delete(key);
}
const tabs = computed(() => {
  const source = serverTabs.value, order = settings.settings.homeTabOrder || [];
  if (!order.length) return source;
  const visible = source.filter(tab => !order.includes(`__hidden__${getHomeTabKey(tab)}`));
  return (visible.length ? visible : source.slice(0, 1)).slice().sort((a, b) => {
    const ai = order.indexOf(getHomeTabKey(a)), bi = order.indexOf(getHomeTabKey(b));
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
  });
});
const activeIndex = computed(() => Math.max(0, tabs.value.findIndex(tab => getHomeTabKey(tab) === activeKey.value)));
async function loadTabs() {
  error.value = '';
  try {
    const response = await CoolapkTauriAPI.getTabConfig();
    const card = response?.data?.find((item: any) => String(item.entityId) === '6390' || (item.entityTemplate === 'configCard' && (item.title === '首页' || String(item.title).includes('TAB配置'))));
    if (!Array.isArray(card?.entities) || !card.entities.length) throw new Error('未获取到首页栏目');
    serverTabs.value = card.entities.filter((tab: ConfigPageTab) => tab.page_name !== 'V9_HOME_TAB_TOPIC' && !tab.url?.includes('V9_HOME_TAB_TOPIC') && tab.title !== '话题');
    activeKey.value = resolvePreferredHomeTab(tabs.value, settings.settings.defaultHomeTab);
    position.value = activeIndex.value;
    visited.add(activeKey.value);
    await nextTick(); measure();
  } catch (err) { error.value = err instanceof Error ? err.message : String(err); }
}
let frame = 0, clickUntil = 0, observer: ResizeObserver | undefined;
type Drag = { id: number; x: number; y: number; origin: number; lastX: number; lastTime: number; velocity: number; axis: 'pending' | 'horizontal' };
let drag: Drag | null = null;
function stopAnimation() { cancelAnimationFrame(frame); frame = 0; }
function settle(target: number) {
  stopAnimation();
  target = Math.max(0, Math.min(tabs.value.length - 1, target));
  const from = position.value, start = performance.now();
  const finish = () => { position.value = target; activeKey.value = getHomeTabKey(tabs.value[target]!); visited.add(activeKey.value); frame = 0; moving.value = false; };
  if (!props.mobile || window.matchMedia('(prefers-reduced-motion: reduce)').matches || Math.abs(target - from) < .001) { finish(); return; }
  moving.value = true;
  const animate = (now: number) => {
    const progress = Math.min(1, (now - start) / 260);
    position.value = from + (target - from) * (1 - Math.pow(1 - progress, 3));
    if (progress < 1) frame = requestAnimationFrame(animate); else finish();
  };
  frame = requestAnimationFrame(animate);
}
function select(key: string) {
  const index = tabs.value.findIndex(tab => getHomeTabKey(tab) === key);
  if (index < 0) return;
  drag = null;
  if (props.mobile) {
    for (let i = Math.min(Math.floor(position.value), index); i <= Math.max(Math.ceil(position.value), index); i++) {
      const tab = tabs.value[i]; if (tab) visited.add(getHomeTabKey(tab));
    }
  } else {
    visited.add(key);
  }
  settle(index);
}
async function selectSubTab(selection: HomeSubChannelSelection) {
  select(selection.parentKey);
  await nextTick();
  panels.get(selection.parentKey)?.handleHomeSubChannelSelected(selection);
}
function nestedScroller(target: EventTarget | null) {
  let el = target instanceof HTMLElement ? target : null;
  while (el && el !== viewport.value) {
    const overflow = getComputedStyle(el).overflowX;
    if ((overflow === 'auto' || overflow === 'scroll') && el.scrollWidth > el.clientWidth + 1) return true;
    el = el.parentElement;
  }
  return false;
}
function startDrag(event: PointerEvent) {
  if (!event.isPrimary || event.pointerType === 'mouse' || nestedScroller(event.target)) return;
  if (event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
  stopAnimation();
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, origin: position.value, lastX: event.clientX, lastTime: performance.now(), velocity: 0, axis: 'pending' };
}
function moveDrag(event: PointerEvent) {
  if (!drag || drag.id !== event.pointerId) return;
  const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
  if (drag.axis === 'pending') {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
    if (Math.abs(dx) <= Math.abs(dy) * 1.25) { drag = null; settle(activeIndex.value); return; }
    drag.axis = 'horizontal'; viewport.value?.setPointerCapture(event.pointerId);
    moving.value = true;
  }
  const now = performance.now(), elapsed = now - drag.lastTime;
  if (elapsed > 0) drag.velocity = (event.clientX - drag.lastX) / elapsed;
  drag.lastX = event.clientX; drag.lastTime = now;
  const desired = drag.origin - dx / width.value, last = tabs.value.length - 1;
  // 首尾保留阻尼，松手回到边界。
  position.value = desired < 0 ? desired * .2 : desired > last ? last + (desired - last) * .2 : desired;
  clickUntil = now + 500;
  event.preventDefault();
}
function endDrag(event: PointerEvent, cancelled = false) {
  if (!drag || drag.id !== event.pointerId) return;
  const gesture = drag; drag = null;
  if (gesture.axis !== 'horizontal') { settle(activeIndex.value); return; }
  if (viewport.value?.hasPointerCapture(event.pointerId)) viewport.value.releasePointerCapture(event.pointerId);
  const dx = event.clientX - gesture.x;
  const velocity = performance.now() - gesture.lastTime > 100 ? 0 : gesture.velocity;
  const change = !cancelled && (Math.abs(dx) > width.value * .22 || (Math.abs(dx) > 12 && Math.abs(velocity) > .45));
  settle(change ? activeIndex.value + (dx < 0 ? 1 : -1) : activeIndex.value);
  clickUntil = performance.now() + 400;
}
function cancelDrag(event: PointerEvent) { endDrag(event, true); }
function pointerUp(event: PointerEvent) { endDrag(event); }
function blockSwipeClick(event: MouseEvent) {
  if (performance.now() < clickUntil) { event.preventDefault(); event.stopPropagation(); }
}
let wheelDelta = 0, wheelTimer: ReturnType<typeof setTimeout> | undefined;
function wheel(event: WheelEvent) {
  if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || nestedScroller(event.target)) return;
  event.preventDefault();
  if (frame) return;
  wheelDelta += event.deltaX;
  if (Math.abs(wheelDelta) >= 56) { settle(activeIndex.value + (wheelDelta > 0 ? 1 : -1)); wheelDelta = 0; }
  clearTimeout(wheelTimer); wheelTimer = setTimeout(() => { wheelDelta = 0; }, 260);
}
function measure() { width.value = Math.max(1, viewport.value?.clientWidth || 1); }
watch(() => props.mobile, () => {
  // 改变布局时结束未完成的手势，保留已选栏目及其页面实例。
  resetGesture();
  clickUntil = 0;
  if (!props.mobile) sidebarMounted.value = true;
  void nextTick(measure);
});
function bind() {
  window.addEventListener('pointermove', moveDrag, { passive: false });
  window.addEventListener('pointerup', pointerUp); window.addEventListener('pointercancel', cancelDrag);
}
function unbind() {
  window.removeEventListener('pointermove', moveDrag); window.removeEventListener('pointerup', pointerUp); window.removeEventListener('pointercancel', cancelDrag);
  resetGesture();
}
function resetGesture() {
  drag = null; stopAnimation(); position.value = activeIndex.value; moving.value = false; clearTimeout(wheelTimer); wheelDelta = 0;
}
watch(tabs, () => { if (tabs.value.length && !tabs.value.some(tab => getHomeTabKey(tab) === activeKey.value)) activeKey.value = getHomeTabKey(tabs.value[0]!); if (!drag && !frame) position.value = activeIndex.value; });
onMounted(() => { bind(); void loadTabs(); void loadHotKeywords(); observer = new ResizeObserver(measure); });
watch(viewport, el => { observer?.disconnect(); if (el) { observer?.observe(el); measure(); } });
onActivated(bind); onDeactivated(unbind);
onUnmounted(() => { unbind(); observer?.disconnect(); });
</script>
<style scoped>
.mobile-home-pager { container-type: inline-size; container-name: home-layout; display: flex; width: 100%; height: 100%; min-height: 0; overflow: hidden; background: var(--surface); }
.home-main-column { display: flex; flex-direction: column; flex: 1; min-width: 0; min-height: 0; }
.home-toolbar { display: flex; flex: 0 0 auto; min-width: 0; }
.home-toolbar :deep(.feed-tabs-wrapper) { flex: 1; min-width: 0; }
.desktop-home-pager .home-main-column { border-right: 1px solid var(--border); }
@container home-layout (max-width: 960px) { :deep(.right-sidebar) { display: none !important; } }
.pager-viewport { position: relative; flex: 1; min-height: 0; overflow: hidden; touch-action: pan-y; }
.pager-track { position: relative; height: 100%; width: 100%; will-change: transform; }
.pager-page { position: absolute; top: 0; width: 100%; height: 100%; overflow: hidden; }
.pager-state { padding: 24px; text-align: center; color: var(--text-secondary); }
.pager-state button { min-height: 44px; }

/* 照界面稿（prototype/home.html）重排桌面首页：
   大标题 → 栏目行 → 快捷入口行（顺序与稿子一致），顶部另加面包屑 */
@media (min-width: 721px) {
  .pager-home-header {
    flex: 0 0 auto;
    padding: 12px 18px 2px;
    background: var(--surface);
  }

  /* 面包屑：稿子在顶栏左侧，客户端放在内容列顶部（同一纵向位置，避开窗口拖拽区） */
  .pager-home-crumb {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
    font-size: 13px;
    line-height: 1.4;
    color: var(--text-secondary);
  }

  .pager-home-crumb .crumb-back,
  .pager-home-crumb .crumb-sep {
    color: var(--text-tertiary);
    font-style: normal;
  }

  .pager-home-crumb .crumb-current {
    color: var(--text-primary);
    font-weight: 600;
  }

  .pager-home-title {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 8px;
    margin: 0;
    font-size: 22px;
    line-height: 1.3;
    font-weight: 700;
    color: var(--text-primary);
  }

  .pager-home-sub {
    font-size: 12.5px;
    font-weight: 400;
    color: var(--text-tertiary);
  }

  .pager-home-quick {
    display: flex;
    gap: 8px;
    padding: 0 18px 10px;
    overflow-x: auto;
    background: var(--surface);
  }

  .pager-home-chip {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 5px 12px;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--surface);
    color: var(--text-secondary);
    font-family: inherit;
    font-size: 12.5px;
    white-space: nowrap;
    cursor: pointer;
  }

  .pager-home-chip b {
    color: var(--brand-primary);
    font-weight: 700;
  }

  .pager-home-chip:hover {
    border-color: var(--brand-primary);
    color: var(--brand-primary);
  }

  /* 栏目行：横向滚动细标签条 → 整页换行的胶囊标签块 */
  .home-toolbar {
    align-items: flex-start;
    padding: 10px 18px 8px;
  }

  .home-toolbar :deep(.feed-tabs.is-wrap) {
    flex-wrap: wrap;
    gap: 4px;
    min-height: 0;
    padding: 0;
    overflow: visible;
  }

  .home-toolbar :deep(.feed-tabs.is-wrap .tab-item) {
    min-height: 30px;
    padding: 6px 10px;
    border-radius: 8px;
    color: var(--text-secondary);
    font-size: 13px;
  }

  .home-toolbar :deep(.feed-tabs.is-wrap .tab-item.is-active) {
    background: var(--brand-green-light, rgba(65, 184, 131, 0.14));
    color: var(--brand-primary);
    font-weight: 600;
  }

  .home-toolbar :deep(.feed-tabs.is-wrap .coolapk-tab-indicator) {
    display: none;
  }
}
</style>
