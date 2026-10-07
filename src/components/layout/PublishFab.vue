<template>
  <button
    ref="fabRef"
    type="button"
    class="publish-fab"
    :class="{ 'is-dragging': isDragging, 'is-moved': hasCustomPosition }"
    :style="fabStyle"
    :title="hasCustomPosition ? '发布动态（拖动可换位置）' : '发布动态（按住可拖动）'"
    aria-label="发布动态"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="handlePointerEnd"
    @pointercancel="handlePointerEnd"
    @click="handleClick"
  >
    <!--
      悬浮发布按钮（界面稿 v4；2026-10-07 复审：可拖动）。
      默认停在内容区底部中间，毛玻璃质感；按住可拖到任意位置，松手后记住坐标
      （settings.publishFabPosition，相对内容区左上角；null = 默认底部居中）。
      拖动结束后那一次 click 会被吞掉，不会误触发发布弹窗。
      桌面端显示；手机端由 MobileBottomNav 的发布按钮承担，这里隐藏。
    -->
    <i class="fas fa-plus publish-fab-icon"></i>
    <span class="publish-fab-label">发布动态</span>
  </button>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useAppStore } from '../../stores/app';
import { useSettingsStore } from '../../stores/settings';
import type { PublishFabPosition } from '../../types/settings';

const appStore = useAppStore();
const settingsStore = useSettingsStore();

const fabRef = ref<HTMLButtonElement | null>(null);
const isDragging = ref(false);
// 初始位置来自设置；拖动过程中先改本地值（跟手），松手才写回设置（只落盘一次）。
const position = ref<PublishFabPosition | null>(settingsStore.settings.publishFabPosition ?? null);

/** 位移超过这个像素数才算「拖动」，避免手抖把点击吃掉。 */
const DRAG_THRESHOLD = 4;
/** 与内容区边缘保持的间距，防止按钮贴边或被拖出可视区。 */
const EDGE_MARGIN = 8;

type DragSession = {
  pointerId: number;
  startX: number;
  startY: number;
  originLeft: number;
  originTop: number;
};

let dragSession: DragSession | null = null;
let draggedInThisGesture = false;

const hasCustomPosition = computed(() => position.value !== null);
const fabStyle = computed(() => (position.value
  ? { left: `${position.value.x}px`, top: `${position.value.y}px` }
  : undefined));

function getDragContext() {
  const element = fabRef.value;
  const parent = (element?.offsetParent as HTMLElement | null) ?? null;
  if (!element || !parent) return null;
  return { element, parent };
}

function clampPosition(
  target: PublishFabPosition,
  parentWidth: number,
  parentHeight: number,
  width: number,
  height: number,
): PublishFabPosition {
  const maxX = Math.max(EDGE_MARGIN, parentWidth - width - EDGE_MARGIN);
  const maxY = Math.max(EDGE_MARGIN, parentHeight - height - EDGE_MARGIN);
  return {
    x: Math.min(Math.max(target.x, EDGE_MARGIN), maxX),
    y: Math.min(Math.max(target.y, EDGE_MARGIN), maxY),
  };
}

function handlePointerDown(event: PointerEvent) {
  // 只处理主键（左键 / 触摸）；中键、右键不进入拖动。
  if (event.button !== 0) return;
  const context = getDragContext();
  if (!context) return;
  const { element, parent } = context;
  const rect = element.getBoundingClientRect();
  const parentRect = parent.getBoundingClientRect();
  dragSession = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originLeft: rect.left - parentRect.left,
    originTop: rect.top - parentRect.top,
  };
  draggedInThisGesture = false;
  isDragging.value = true;
  try {
    element.setPointerCapture?.(event.pointerId);
  } catch {
    // 无布局环境（部分单测 DOM）不支持指针捕获：拖动仍靠按钮自身的 pointermove 事件
  }
}

function handlePointerMove(event: PointerEvent) {
  if (!dragSession || event.pointerId !== dragSession.pointerId) return;
  const deltaX = event.clientX - dragSession.startX;
  const deltaY = event.clientY - dragSession.startY;
  if (!draggedInThisGesture && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return;
  draggedInThisGesture = true;

  const context = getDragContext();
  if (!context) return;
  const { element, parent } = context;
  position.value = clampPosition(
    { x: dragSession.originLeft + deltaX, y: dragSession.originTop + deltaY },
    parent.clientWidth,
    parent.clientHeight,
    element.offsetWidth,
    element.offsetHeight,
  );
  event.preventDefault();
}

function handlePointerEnd(event: PointerEvent) {
  if (!dragSession || event.pointerId !== dragSession.pointerId) return;
  try {
    fabRef.value?.releasePointerCapture?.(event.pointerId);
  } catch {
    // 同上：捕获不可用时无需释放
  }
  dragSession = null;
  isDragging.value = false;
  if (draggedInThisGesture && position.value) {
    settingsStore.setPublishFabPosition(position.value);
  }
}

function handleClick() {
  // 刚拖动完：这一次 click 是拖动的收尾，不当作「点击发布」。
  if (draggedInThisGesture) {
    draggedInThisGesture = false;
    return;
  }
  appStore.openPublish();
}

/** 窗口尺寸变化后把记住的位置拉回可视区（只改显示，不改设置）。 */
function reclampPosition() {
  if (!position.value) return;
  const context = getDragContext();
  if (!context) return;
  const { element, parent } = context;
  position.value = clampPosition(
    position.value,
    parent.clientWidth,
    parent.clientHeight,
    element.offsetWidth,
    element.offsetHeight,
  );
}

onMounted(() => {
  reclampPosition();
  window.addEventListener('resize', reclampPosition);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', reclampPosition);
});
</script>

<style scoped>
.publish-fab {
  position: absolute;
  left: 50%;
  bottom: 26px;
  transform: translateX(-50%);
  z-index: 60;

  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 46px;
  padding: 0 22px;

  border: 1px solid rgba(255, 255, 255, 0.45);
  border-radius: 23px;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  /* 可拖动：默认手型抓取光标，拖动中握紧；触摸端交给 pointer 事件，禁止页面滚动抢手势 */
  cursor: grab;
  touch-action: none;
  user-select: none;

  /* 毛玻璃：半透明品牌绿 + 背后模糊 */
  background-color: rgba(47, 160, 111, 0.72);
  background-color: color-mix(in srgb, var(--brand-primary) 70%, transparent);
  -webkit-backdrop-filter: blur(14px) saturate(170%);
  backdrop-filter: blur(14px) saturate(170%);
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.4);
  transition:
    transform var(--duration-fast) var(--ease-default),
    background-color var(--duration-fast) var(--ease-default),
    box-shadow var(--duration-fast) var(--ease-default);
}

/* 被拖到自定义位置后不再用 translateX(-50%) 居中，也不做上浮位移（避免与拖动坐标打架） */
.publish-fab.is-moved {
  bottom: auto;
  transform: none;
}

.publish-fab:hover {
  background-color: color-mix(in srgb, var(--brand-hover, var(--brand-primary)) 80%, transparent);
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.26), inset 0 1px 0 rgba(255, 255, 255, 0.5);
}

.publish-fab:not(.is-moved):hover {
  transform: translateX(-50%) translateY(-2px);
}

.publish-fab:not(.is-moved):active {
  transform: translateX(-50%) scale(0.97);
}

.publish-fab.is-dragging {
  cursor: grabbing;
  transition: none;
}

.publish-fab:focus-visible {
  outline: 2px solid var(--brand-primary);
  outline-offset: 3px;
}

.publish-fab-icon {
  font-size: 16px;
  line-height: 1;
}
</style>
