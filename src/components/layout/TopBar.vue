<template>
  <header
    class="top-bar"
    :class="{ 'is-macos': usesMacOverlay, 'has-window-controls': showWindowControls }"
    data-tauri-drag-region="deep"
  >
    <!--
      左上角品牌块：固定为酷安 logo + 「酷安」（2026-10-07 复审：账号入口搬回右上角）。
      占位宽度与左栏一致，视觉上和左栏连成一体。
      macOS 叠层模式由 CSS 隐藏（.top-bar.is-macos .titlebar-sidebar-offset）。
    -->
    <div
      class="titlebar-sidebar-offset"
      :class="{ 'is-collapsed': settingsStore.settings.sidebarCollapsed }"
      data-tauri-drag-region
    >
      <BrandLogo :collapsed="settingsStore.settings.sidebarCollapsed" />
    </div>

    <div class="top-bar-center" data-tauri-drag-region="false">
      <div class="global-navigation" aria-label="页面导航">
        <AppIconButton
          icon="fas fa-arrow-left"
          title="后退"
          aria-label="后退"
          size="sm"
          :disabled="!canGoBack"
          @click="goBack"
        />
        <AppIconButton
          icon="fas fa-arrow-right"
          title="前进"
          aria-label="前进"
          size="sm"
          :disabled="!canGoForward"
          @click="goForward"
        />
        <AppIconButton
          icon="fas fa-rotate-right"
          title="刷新当前页面"
          aria-label="刷新当前页面"
          size="sm"
          @click="refreshPage"
        />
        <span class="back-to-top-control">
          <BackToTop variant="nav" />
        </span>
      </div>
      <div class="search-input-wrapper" @click="appStore.openSearch">
        <i class="fas fa-search search-icon"></i>
        <span class="placeholder-text">搜索应用、动态、用户、话题</span>
        <kbd v-if="showShortcutHints" class="shortcut-kbd">{{ formatShortcut('Ctrl+K') }}</kbd>
      </div>
    </div>

    <!--
      拖拽垫片：flex:1 吃掉搜索框与右侧动作区之间的空白。
      2026-10-07（界面稿 v4）：通知 / 私信 从侧栏搬回顶栏右上角（TopBarActions），
      账号入口（头像 + 资料浮层）放在最右侧（AccountEntry），主题（情景模式）按钮紧随其左；
      左下角只保留个人中心卡片；发布按钮改为首页底部居中的悬浮按钮（PublishFab，可拖动）；
      左右栏开关仍是侧栏边缘悬停手柄。
    -->
    <div class="titlebar-drag-spacer" data-tauri-drag-region></div>

    <div class="top-bar-right" data-tauri-drag-region="false">
      <TopBarActions />
      <AppIconButton
        :icon="settingsStore.themeToggleIcon()"
        :title="settingsStore.themeToggleLabel()"
        :aria-label="settingsStore.themeToggleLabel()"
        size="sm"
        class="topbar-theme-toggle"
        @click="settingsStore.cycleTheme()"
      />
      <!-- 账号入口：头像 + 悬停资料浮层（最右侧，紧邻窗口按钮） -->
      <AccountEntry />
    </div>

    <WindowControls
      v-if="showWindowControls"
      :is-maximized="isMaximized"
      @minimize="minimize"
      @toggle-maximize="toggleMaximize"
      @close="close"
    />
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAppStore } from '../../stores/app';
import { usePageTabsStore } from '../../stores/pageTabs';
import { useSettingsStore } from '../../stores/settings';
import {
  getNotificationCategoryCountsFromItems,
  hasNotificationCountIncreased,
  type NotificationCategory,
} from '../../utils/notificationCount';
import {
  addSeenNotificationCount,
  clearSeenNotificationState,
  hasSeenNotificationItems,
  markNotificationItemsSeen,
  takeSeenNotificationCount,
} from '../../utils/notificationSeen';
import {
  canNavigateBack,
  canNavigateForward,
  navigateBack,
  navigateForward,
} from '../../utils/navigation';
import AppIconButton from '../common/AppIconButton.vue';
import BackToTop from '../common/BackToTop.vue';
import AccountEntry from './AccountEntry.vue';
import BrandLogo from './BrandLogo.vue';
import TopBarActions from './TopBarActions.vue';
import WindowControls from './WindowControls.vue';
import { usePlatformShortcuts } from '../../utils/shortcuts';
import { useShortcutHints } from '../../composables/useShortcutHints';
import { useDesktopWindow } from '../../composables/useDesktopWindow';
import { refreshPageTabGeneration } from '../../utils/pageTabs';

const router = useRouter();
const route = useRoute();
const appStore = useAppStore();
const pageTabsStore = usePageTabsStore();
const settingsStore = useSettingsStore();
const { formatShortcut } = usePlatformShortcuts();
const showShortcutHints = useShortcutHints();
const {
  isMaximized,
  usesMacOverlay,
  showWindowControls,
  minimize,
  toggleMaximize,
  close,
} = useDesktopWindow();


// 由路由器维护桌面端页面栈。
// 通过当前路由的变化触发计算，保证页面进入、替换和返回后按钮状态同步更新。
const canGoBack = computed(() => Boolean(route.fullPath && canNavigateBack(router)));
const canGoForward = computed(() => Boolean(route.fullPath && canNavigateForward(router)));

function goBack() {
  navigateBack(router);
}

function goForward() {
  navigateForward(router);
}

function refreshPage() {
  refreshPageTabGeneration(pageTabsStore.tabs, route);
}
</script>

<style scoped>
.top-bar {
  --macos-traffic-light-safe-width: 86px;
  position: relative;
  height: var(--topbar-height);
  min-height: var(--topbar-height);
  background-color: var(--titlebar-background);
  border-bottom: 1px solid var(--titlebar-divider);
  display: flex;
  align-items: center;
  user-select: none;
  z-index: 800;
}

.titlebar-sidebar-offset {
  align-self: stretch;
  flex: 0 0 var(--sidebar-width);
  display: flex;
  align-items: center;
  min-width: 0;
  transition: flex-basis var(--duration-normal) var(--ease-default);
}

/* macOS Overlay 的原生红黄绿按钮占用左侧区域，桌面标题栏不显示品牌/账号区。 */
.top-bar.is-macos .titlebar-sidebar-offset {
  visibility: hidden;
}

.titlebar-sidebar-offset.is-collapsed {
  flex-basis: var(--sidebar-collapsed-width);
}

.top-bar.is-macos .titlebar-sidebar-offset.is-collapsed {
  flex-basis: var(--macos-traffic-light-safe-width);
}

.top-bar-center {
  flex: 0 1 640px;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  overflow: hidden;
}

.top-bar.is-macos .top-bar-center {
  flex-basis: 620px;
}

.titlebar-drag-spacer {
  align-self: stretch;
  flex: 1 1 40px;
  min-width: var(--space-2);
}

/* 顶栏右上角动作区容器：通知 / 私信 / 账号 + 主题，整块贴右（窄窗口带窗口按钮时整块隐藏） */
.top-bar-right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
  margin-left: var(--space-2);
  margin-right: var(--space-4);
}

/* 顶栏右上角的主题（情景模式）按钮：界面稿 v3 定稿位置 */
.topbar-theme-toggle {
  flex-shrink: 0;
  color: var(--text-secondary);
  transition: color var(--duration-fast) var(--ease-default), transform var(--duration-fast) var(--ease-default);
}

.topbar-theme-toggle:hover {
  color: var(--brand-primary);
}

.global-navigation {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 0 0 auto;
  padding: 2px;
  border-radius: var(--radius-control);
}

.search-input-wrapper {
  flex: 1 1 260px;
  min-width: 88px;
  display: flex;
  align-items: center;
  height: 38px;
  background-color: var(--background);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-pill);
  padding: 0 var(--space-4);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-default);
  overflow: hidden;
}

.search-input-wrapper:hover {
  border-color: var(--brand-primary);
  background-color: var(--surface);
}

.search-input-wrapper:hover .search-icon {
  color: var(--brand-primary);
  transform: scale(1.1);
}

.search-input-wrapper:hover .shortcut-kbd {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.search-icon {
  color: var(--text-tertiary);
  margin-right: var(--space-3);
  font-size: 14px;
  flex-shrink: 0;
  transition: transform var(--duration-fast), color var(--duration-fast);
}

.placeholder-text {
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-sub);
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.shortcut-kbd {
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  padding: 2px 6px;
  font-size: 11px;
  color: var(--text-tertiary);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  white-space: nowrap;
  flex-shrink: 0;
  transition: all var(--duration-fast);
}

@media (max-width: 1100px) {
  .titlebar-sidebar-offset {
    flex-basis: var(--sidebar-collapsed-width);
  }

  /* 窄窗口：品牌块只留居中 logo（与左栏折叠节奏一致） */
  .titlebar-sidebar-offset :deep(.brand-area) {
    padding-left: 13px;
  }

  .titlebar-sidebar-offset :deep(.brand-name) {
    display: none;
  }

  .top-bar.is-macos .titlebar-sidebar-offset {
    flex-basis: var(--macos-traffic-light-safe-width);
  }

  .top-bar-center {
    flex-basis: 520px;
  }

.placeholder-text {
    display: none;
  }

.search-icon {
    margin-right: 0;
  }

.search-input-wrapper {
    flex-basis: 120px;
    padding: 0 var(--space-3);
  }
}

@media (max-width: 800px) {
.shortcut-kbd {
    display: none;
  }

.back-to-top-control {
    display: none;
  }

.titlebar-drag-spacer {
    min-width: var(--space-1);
  }

.top-bar.has-window-controls {
    --window-control-width: 36px;
  }
}

@media (max-width: 720px) {
.search-input-wrapper {
    flex: 0 0 36px;
    min-width: 36px;
    padding: 0;
    justify-content: center;
  }
}

</style>
