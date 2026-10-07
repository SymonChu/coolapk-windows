<template>
  <!--
    侧栏边缘悬停手柄（界面稿 v3 定稿交互，2026-10-07）：
    骑在侧栏与内容区的分界线上，平时隐形，鼠标移近才浮现；中间一个方向小箭头。
    点击切换对应侧栏的显示/隐藏；隐藏后手柄仍贴在新分界线上，可随时点回来。
    side="left"  → 开关 settingsStore.toggleSidebar()（左栏）
    side="right" → 开关 settingsStore.toggleHomeRightSidebar()（右栏，仅首页存在）

    右栏手柄挂在首页主列（MobileHomePager 的 .home-main-column）里，靠该容器的
    position: relative 骑在「主列 / 右栏」分界线上；是否渲染（桌面端 + 右栏已挂载）
    由页面判断，这里只挡非首页。
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
}>(), {});

const route = useRoute();
const settingsStore = useSettingsStore();

const visible = computed(() => {
  if (props.side === 'left') return true;
  // 右栏只在首页存在；窄屏（<1200px）由样式隐藏。
  // 注意：这里不能用 disableAutoMobileMode 当条件 —— 开着「窄窗口保持桌面布局」时
  // 右栏照样渲染，那样会把右栏唯一的隐藏入口整块吃掉（v0.5.1 的回归）。
  // 路由用可选链：组件在无路由上下文的测试/宿主里也要能渲染（否则整块崩掉）。
  return route?.path === '/';
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
