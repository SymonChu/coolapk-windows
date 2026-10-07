<template>
  <!--
    侧栏边缘悬停手柄（界面稿 v3 定稿交互，2026-10-07）：
    骑在侧栏与内容区的分界线上，平时隐形，鼠标移近才浮现；中间一个方向小箭头。
    点击切换对应侧栏的显示/隐藏；隐藏后手柄仍贴在新分界线上，可随时点回来。
    side="left"  → 开关 settingsStore.toggleSidebar()（左栏）
    side="right" → 开关 settingsStore.toggleHomeRightSidebar()（右栏，仅首页存在）
  -->
  <button
    v-if="visible"
    type="button"
    :class="['sidebar-edge-grip', `is-${side}`, { 'is-hidden-state': hiddenState }]"
    :aria-label="hiddenState ? restoreLabel : hideLabel"
    :title="hiddenState ? restoreLabel : hideLabel"
    @click.stop="toggle"
  >
    <span class="grip-pill">
      <i :class="['fas', hiddenState ? arrowRestore : arrowHide]"></i>
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useSettingsStore } from '../../stores/settings';

const props = withDefaults(defineProps<{
  side: 'left' | 'right';
  /** 手柄所属容器（决定贴边定位方式）：main = app-main-content（左栏用），page = 页面根（右栏用） */
  host?: 'main' | 'page';
}>(), { host: 'main' });

const route = useRoute();
const settingsStore = useSettingsStore();

const visible = computed(() => {
  if (props.side === 'left') return true;
  // 右栏手柄只在首页显示，且窄屏（<1200px）右栏本身就不渲染
  return route.path === '/' && !settingsStore.settings.disableAutoMobileMode;
});

const hiddenState = computed(() => props.side === 'left'
  ? settingsStore.settings.sidebarCollapsed
  : settingsStore.settings.hideHomeRightSidebar);

const hideLabel = computed(() => props.side === 'left' ? '隐藏左侧栏' : '隐藏右侧栏');
const restoreLabel = computed(() => props.side === 'left' ? '显示左侧栏' : '显示右侧栏');
const arrowHide = computed(() => props.side === 'left' ? 'fa-chevron-left' : 'fa-chevron-right');
const arrowRestore = computed(() => props.side === 'left' ? 'fa-chevron-right' : 'fa-chevron-left');

function toggle() {
  if (props.side === 'left') settingsStore.toggleSidebar();
  else settingsStore.toggleHomeRightSidebar();
}
</script>

<style scoped>
.sidebar-edge-grip {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 14px;
  z-index: 860;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
}

/* 左手柄骑在左栏右缘（挂 .app-main-content 上时其 x=0 即分界线） */
.sidebar-edge-grip.is-left {
  left: 0;
  margin-left: -7px;
}

/* 右手柄骑在右栏左缘（挂页面根、紧贴右栏兄弟位置） */
.sidebar-edge-grip.is-right {
  right: 0;
  margin-right: -7px;
}

/* 窄屏（<1200px）右栏整体不渲染，手柄一并隐藏 */
@media (max-width: 1200px) {
  .sidebar-edge-grip.is-right {
    display: none;
  }
}

.grip-pill {
  width: 8px;
  height: 44px;
  border-radius: 5px;
  background-color: var(--border, #d4d9df);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-default), background-color var(--duration-fast) var(--ease-default);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
}

.sidebar-edge-grip:hover .grip-pill,
.sidebar-edge-grip:focus-visible .grip-pill {
  opacity: 1;
  background-color: var(--brand-primary);
}

/* 栏处于隐藏态时手柄常显（否则找不到入口还原） */
.sidebar-edge-grip.is-hidden-state .grip-pill {
  opacity: 1;
}
</style>
