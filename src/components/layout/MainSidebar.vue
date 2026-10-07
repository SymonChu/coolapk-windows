<template>
  <Teleport to="#app">
    <button
      v-if="mobileOpen"
      type="button"
      :class="['mobile-sidebar-backdrop', { 'has-window-controls': mobileWindowControls }]"
      aria-label="关闭导航菜单"
      @click="emit('closeMobile')"
    ></button>
  </Teleport>

  <aside :class="['main-sidebar', { 'is-collapsed': isCollapsed, 'is-mobile-open': mobileOpen, 'has-window-controls': mobileWindowControls }]">
    <div v-if="mobileOpen" class="mobile-navigation-header">
      <strong>快捷入口</strong>
      <span>频道与常用功能</span>
    </div>

    <nav class="sidebar-nav custom-scrollbar">
      <div class="nav-group">
        <router-link
          v-for="item in primaryNavs"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          active-class="is-active"
          :title="item.label"
          @click="handlePrimaryNavClick($event, item.path)"
        >
          <i :class="[item.icon, 'nav-icon']"></i>
          <span v-if="!isCollapsed || mobileOpen" class="nav-label">{{ item.label }}</span>
        </router-link>

        <router-link
          v-if="moreVisible"
          to="/more"
          class="nav-item"
          :class="{ 'is-active': isMoreActive }"
          title="更多服务与专区"
          @click="handleNavSelection"
        >
          <i class="fas fa-shapes nav-icon"></i>
          <span v-if="!isCollapsed || mobileOpen" class="nav-label">更多</span>
        </router-link>

      </div>

      <!-- 界面稿里的分组标题：「我的社区」用来把个人相关入口与上面的频道分开 -->
      <div v-if="!isCollapsed || mobileOpen" class="nav-group-title">我的社区</div>

      <div class="nav-divider"></div>

      <div class="nav-group">
        <router-link
          v-for="item in secondaryNavs"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          active-class="is-active"
          :title="getNavTitle(item)"
          @click="handleNavSelection"
        >
          <i :class="[item.icon, 'nav-icon']"></i>
          <span v-if="!isCollapsed || mobileOpen" class="nav-label">{{ item.label }}</span>
          <span
            v-if="getNavBadge(item.key) > 0"
            :class="['nav-badge', { 'is-wide': getNavBadge(item.key) > 9 }]"
          >
            {{ getNavBadge(item.key) > 99 ? '99+' : getNavBadge(item.key) }}
          </span>
        </router-link>
      </div>

      <router-link
        v-if="myVisible"
        to="/my"
        class="nav-item"
        :class="{ 'is-active': isMyActive }"
        active-class="is-active"
        title="我的"
        @click="handleNavSelection"
      >
        <i class="fas fa-user nav-icon"></i>
        <span v-if="!isCollapsed || mobileOpen" class="nav-label">我的</span>
      </router-link>

      <div class="nav-divider"></div>

      <div class="nav-group">
        <router-link to="/settings" class="nav-item" active-class="is-active" title="设置" @click="handleNavSelection">
          <i class="fas fa-cog nav-icon"></i>
          <span v-if="!isCollapsed || mobileOpen" class="nav-label">设置</span>
        </router-link>
      </div>
    </nav>

    <!--
      左下角：版本信息 + 动作区。
      动作区（主题/左右栏/发布/通知/私信/账号）2026-10-06 从顶栏右侧搬来。
      「反馈」「更新」两个按钮已移除：设置 → 关于 页面里已有「检查更新」和「问题反馈」，
      左下角只保留版本号，避免同一功能两个入口。
    -->
    <div class="sidebar-footer">
      <!--
        个人中心卡片（界面稿 v3 / 参考稿）：
        头像 + 名字 + 等级 + 经验进度条（含 当前/上限 数值）+ 签名 + 获赞/关注/粉丝 数据列。
        收起态只保留头像。
      -->
      <div
        class="me-card"
        :title="authStore.isLoggedIn ? '个人中心' : '点击登录酷安'"
        @click="handleUserCardClick"
      >
        <div class="me-main">
          <div class="me-avatar-box">
            <AppAvatar :src="authStore.user?.userAvatar" size="sm" />
          </div>
          <div v-if="!isCollapsed || mobileOpen" class="me-info">
            <template v-if="authStore.isLoggedIn && authStore.user">
              <div class="me-name-row">
                <span class="me-name">{{ authStore.user.username }}</span>
                <span class="me-level-badge">Lv.{{ authStore.user.level || 1 }}</span>
              </div>
              <div class="me-exp-row">
                <div class="me-exp-bar">
                  <div class="me-exp-fill" :style="{ width: `${getExpPercent(authStore.user)}%` }"></div>
                </div>
                <span class="me-exp-num">{{ getExpCurrent(authStore.user) }}/{{ getExpMax(authStore.user) }}</span>
              </div>
              <div class="me-bio" :title="authStore.user.bio">
                <i class="fas fa-pen me-bio-icon"></i>
                <span class="me-bio-text">{{ authStore.user.bio || '点击设置我的签名' }}</span>
              </div>
            </template>
            <template v-else>
              <div class="me-name-row">
                <span class="me-name">未登录</span>
              </div>
              <div class="me-bio">
                <span class="me-bio-text">点击头像登录酷安</span>
              </div>
            </template>
          </div>
        </div>
        <div
          v-if="(!isCollapsed || mobileOpen) && authStore.isLoggedIn && authStore.user"
          class="me-stats"
        >
          <div class="me-stat">
            <b>{{ formatNum(authStore.user.likenum) }}</b>
            <span>获赞</span>
          </div>
          <div class="me-stat">
            <b>{{ formatNum(authStore.user.follow) }}</b>
            <span>关注</span>
          </div>
          <div class="me-stat">
            <b>{{ formatNum(authStore.user.fans) }}</b>
            <span>粉丝</span>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSettingsStore } from '../../stores/settings';
import { useAuthStore } from '../../stores/auth';
import { useNotificationStore } from '../../stores/notifications';
import { useDownloadStore } from '../../stores/downloads';
import { triggerSidebarTransition } from '../../utils/routeTransition';
import { activateHomeTab } from '../../utils/homeTab';
import AppAvatar from '../common/AppAvatar.vue';
const route = useRoute();
const router = useRouter();
const settingsStore = useSettingsStore();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();
const downloadStore = useDownloadStore();


function formatNum(n?: number): string {
  const value = Number(n || 0);
  if (value >= 10000) return `${(value / 10000).toFixed(1).replace(/\.0$/, '')}万`;
  return String(value);
}

function getExpCurrent(user: any): number {
  if (!user) return 0;
  return Number(user.exp ?? user.experience ?? user.userExperience ?? 0);
}

function getExpMax(user: any): number {
  if (!user) return 100;
  const level = Number(user.level || 1);
  const max = Number(user.maxExp ?? user.nextLevelExperience ?? user.next_level_experience ?? 0);
  if (max > 0) return max;
  const levelMap = [0, 50, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
  return levelMap[level] || level * 100;
}

function getExpPercent(user: any): number {
  const current = getExpCurrent(user);
  const max = getExpMax(user);
  if (max <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((current / max) * 100)));
}

function handleUserCardClick() {
  if (authStore.isLoggedIn) router.push('/user/me');
  else authStore.openLoginModal();
}

const props = withDefaults(defineProps<{ mobileOpen?: boolean; mobileWindowControls?: boolean }>(), { mobileOpen: false, mobileWindowControls: false });
const emit = defineEmits<{ closeMobile: [] }>();

const mobileOpen = computed(() => props.mobileOpen);

function handleNavSelection() {
  emit('closeMobile');
  triggerSidebarTransition();
}

/**
 * 一级导航点击。
 *
 * 「首页」再点一次时 router-link 的重复导航会被 vue-router 中止，页面停留原地；
 * 这里接管成「单击回到顶部、双击回到顶部并刷新当前栏目」，与移动端底栏一致。
 */
function handlePrimaryNavClick(event: MouseEvent, path: string) {
  handleNavSelection();
  if (path !== '/') return;
  event.preventDefault();
  activateHomeTab(router);
}

function handleNavClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  const link = target?.closest('.nav-item:not(.action-item)');
  if (link) {
    triggerSidebarTransition();
  }
}

const isCollapsed = computed(() => settingsStore.settings.sidebarCollapsed);

// 主侧边栏精简保留核心主干
const allPrimaryNavs = [
  { key: 'home', path: '/', label: '首页', icon: 'fas fa-home' },
  { key: 'digital', path: '/digital', label: '数码', icon: 'fas fa-microchip' },
  { key: 'discover', path: '/discover', label: '发现', icon: 'fas fa-compass' },
  { key: 'topics', path: '/topics', label: '话题', icon: 'fas fa-hashtag' },
  { key: 'pictures', path: '/pictures', label: '酷图', icon: 'far fa-images' },
];

const allSecondaryNavs = [
  { key: 'notifications', path: '/notifications', label: '通知', icon: 'far fa-bell' },
  { key: 'messages', path: '/messages', label: '消息', icon: 'far fa-comment-alt' },
  { key: 'history', path: '/history', label: '历史', icon: 'far fa-clock' },
  { key: 'favorites', path: '/favorites', label: '收藏', icon: 'far fa-bookmark' },
  { key: 'following', path: '/following', label: '关注', icon: 'fas fa-user-group' },
];

const primaryNavs = computed(() => {
  const vis = settingsStore.settings.navVisibility;
  if (!vis) return allPrimaryNavs;
  return allPrimaryNavs.filter((item) => vis[item.key as keyof typeof vis] !== false);
});

const secondaryNavs = computed(() => {
  const vis = settingsStore.settings.navVisibility;
  if (!vis) return allSecondaryNavs;
  return allSecondaryNavs.filter((item) => vis[item.key as keyof typeof vis] !== false);
});

// 属于“更多专区”的下属路由集合
const moreSubPaths = [
  '/more',
  '/apps',
  '/downloads',
  '/my-products',
  '/goods',
  '/center',
  '/albums',
  '/pictures',
  '/secondhand',
  '/reviews',
  '/digital',
  '/digital-library',
  '/games',
  '/events',
  '/event',
  '/anylist',
  '/my-dyh',
  '/product-compare',
  '/product-selector',
  '/headline',
  '/blacklist',
];

// 当处于 /more 或下属未在侧边栏独立展示的专区时，“更多”保持高亮
const isMoreActive = computed(() => {
  const currentPath = route.path;
  if (currentPath === '/more') return true;

  const currentVisiblePaths = [
    ...primaryNavs.value.map((n) => n.path),
    ...secondaryNavs.value.map((n) => n.path),
  ];

  // 如果当前路由已经在主侧边栏独立显示，则不重复高亮“更多”
  if (currentVisiblePaths.some((p) => p === currentPath || (p !== '/' && currentPath.startsWith(p)))) {
    return false;
  }

  // 属于更多子路由集合时高亮
  return moreSubPaths.some((sub) => currentPath === sub || (sub !== '/' && currentPath.startsWith(sub)));
});

const isMyActive = computed(() => {
  const currentPath = route.path;
  return currentPath === '/my'
    || currentPath === '/my-likes'
    || currentPath === '/followed-nodes'
    || currentPath === '/followed-topics'
    || currentPath === '/recent-contacts'
    || currentPath === '/recycle-bin'
    || currentPath === '/hidden-replies'
    || currentPath === '/my-devices'
    || currentPath === '/my-albums'
    || currentPath === '/my-votes';
});

const moreVisible = computed(() => settingsStore.settings.navVisibility?.more !== false);
const myVisible = computed(() => settingsStore.settings.navVisibility?.my !== false);
function getNavBadge(key: string): number {
  if (key === 'notifications') return notificationStore.notificationCount;
  if (key === 'messages') return notificationStore.messageCount;
  if (key === 'downloads') return downloadStore.activeCount;
  return 0;
}

function getNavTitle(item: { key: string; label: string }): string {
  const count = getNavBadge(item.key);
  return count > 0 ? `${item.label}（${count} 条未读）` : item.label;
}


function handleLogout() {
  authStore.logout();
}
</script>

<style scoped>
.main-sidebar {
  position: relative;
  width: var(--sidebar-width);
  background-color: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  height: 100%;
  transition: width var(--duration-normal) var(--ease-default);
  /* 按钮会向内容区伸出少量空间，层级需要高于标签栏才能保证显示和点击。 */
  z-index: 750;
}

.main-sidebar.is-collapsed {
  width: var(--sidebar-collapsed-width);
}

.sidebar-panel-icon {
  display: block;
}

.sidebar-nav {
  flex: 1;
  padding: var(--space-3) var(--space-3);
  overflow-y: auto;
}

.nav-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  height: 42px;
  padding: 0 var(--space-4);
  border-radius: var(--radius-control);
  color: var(--text-secondary);
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-medium);
  transition: all var(--duration-fast) var(--ease-default);
  text-decoration: none;
  border: none;
  background: transparent;
  width: 100%;
  box-sizing: border-box;
}

.nav-item:hover {
  background-color: var(--surface-hover);
  color: var(--text-primary);
}

.nav-item.is-active {
  background-color: var(--brand-soft);
  color: var(--brand-primary);
  font-weight: var(--font-weight-semibold);
}

.nav-item.is-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3.5px;
  height: 18px;
  background-color: var(--brand-primary);
  border-radius: 0 4px 4px 0;
}

/* 照界面稿：选中项改成整块浅绿胶囊，不再另加左侧竖条 */
@media (min-width: 721px) {
  .nav-item.is-active::before {
    display: none;
  }

  .nav-item {
    height: 38px;
  }
}

.nav-icon {
  font-size: 16px;
  width: 20px;
  text-align: center;
  margin-right: var(--space-3);
}

.nav-badge {
  flex: 0 0 20px;
  width: 20px;
  height: 20px;
  margin-left: auto;
  padding: 0;
  border-radius: 50%;
  background-color: var(--danger);
  color: #ffffff;
  font-size: 10px;
  font-weight: var(--font-weight-bold);
  line-height: 20px;
  text-align: center;
}

.nav-badge.is-wide {
  flex-basis: auto;
  width: auto;
  min-width: 20px;
  padding: 0 5px;
  border-radius: var(--radius-full);
}

.main-sidebar.is-collapsed .nav-badge {
  position: absolute;
  top: 4px;
  right: 5px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  line-height: 14px;
  border-radius: 50%;
}

.main-sidebar.is-collapsed .nav-icon {
  margin-right: 0;
}

.main-sidebar.is-collapsed .nav-item {
  justify-content: center;
  padding: 0;
}

.nav-divider {
  height: 1px;
  background-color: var(--divider);
  margin: var(--space-3) var(--space-2);
}

/* 分组标题（界面稿「我的社区」）：弱化为小号灰字，收起为图标栏时隐藏 */
.nav-group-title {
  padding: 2px 14px 2px;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--text-tertiary);
}

.more-chevron {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-tertiary);
}

.more-inline-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-top: var(--space-1);
}

.nav-sub-item {
  height: 36px;
  padding-left: calc(var(--space-4) + 20px + var(--space-3));
  font-size: var(--font-size-caption);
}

.nav-sub-item .nav-icon {
  font-size: 13px;
}

.more-popover {
  position: absolute;
  left: calc(100% + var(--space-3));
  top: 0;
  width: 190px;
  padding: var(--space-2);
  background: var(--surface-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-lg);
  z-index: 120;
}

.more-popover-title {
  padding: var(--space-2) var(--space-3);
  color: var(--text-tertiary);
  font-size: var(--font-size-caption);
}

.more-popover-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 36px;
  padding: 0 var(--space-3);
  color: var(--text-secondary);
  border-radius: var(--radius-control);
  text-decoration: none;
  font-size: var(--font-size-sub);
}

.more-popover-item:hover,
.more-popover-item.router-link-active {
  color: var(--brand-primary);
  background: var(--brand-soft);
}

.action-item {
  cursor: pointer;
}

.primary-item:hover {
  color: var(--brand-primary);
  background-color: var(--brand-soft);
}

.danger-item:hover {
  color: var(--danger);
  background-color: rgba(240, 68, 68, 0.1);
}

.sidebar-footer {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 8px 10px;
  border-top: 1px solid var(--border-light, rgba(0, 0, 0, 0.06));
}

.app-info-card {
  display: none;
}

/* 个人中心卡片（界面稿 v3 / 参考稿：头像+名字+等级+经验条+签名+数据列） */
.me-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  padding: 8px;
  border: none;
  border-radius: var(--radius-control);
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background-color var(--duration-fast) var(--ease-default);
}

.me-card:hover {
  background-color: var(--surface-hover);
}

.me-main {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.me-avatar-box {
  position: relative;
  flex-shrink: 0;
  display: flex;
}

.me-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.me-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.me-name {
  min-width: 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.me-level-badge {
  flex-shrink: 0;
  padding: 1px 5px;
  border-radius: var(--radius-pill, 999px);
  background: linear-gradient(135deg, #2fa06f 0%, #26815e 100%);
  color: #fff;
  font-size: 9.5px;
  font-weight: 800;
  font-style: italic;
  line-height: 1.3;
  box-shadow: 0 1px 4px rgba(47, 160, 111, 0.35);
  pointer-events: none;
}

.me-exp-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.me-exp-bar {
  flex: 1;
  min-width: 0;
  height: 4px;
  border-radius: 2px;
  background-color: var(--background-secondary, rgba(0, 0, 0, 0.08));
  overflow: hidden;
}

.me-exp-fill {
  height: 100%;
  border-radius: 2px;
  background: linear-gradient(90deg, #2fa06f 0%, #3b82f6 100%);
  transition: width var(--duration-normal) var(--ease-default);
}

.me-exp-num {
  flex-shrink: 0;
  font-size: 10.5px;
  font-weight: 550;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.me-bio {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  font-size: 11px;
  color: var(--text-tertiary);
}

.me-bio-icon {
  flex-shrink: 0;
  font-size: 9px;
  opacity: 0.7;
}

.me-bio-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.me-stats {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding-top: 1px;
}

.me-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.me-stat b {
  font-size: 14px;
  font-weight: 750;
  line-height: 1.15;
  color: var(--text-primary);
}

.me-stat span {
  font-size: 10.5px;
  color: var(--text-tertiary);
}

/* 收起态：卡片退化为居中头像，与图标栏节奏一致 */
.main-sidebar.is-collapsed .me-card {
  align-items: center;
  padding: 6px 0;
}

.main-sidebar.is-collapsed .me-main {
  justify-content: center;
}

.app-info-top {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;
  align-items: center;
  justify-content: space-between;
}

.app-name {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
}

.version-badge {
  max-width: 100%;
  box-sizing: border-box;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-tertiary);
  background-color: var(--bg-hover, rgba(0, 0, 0, 0.04));
  padding: 1px 5px;
  border-radius: 4px;
  line-height: 1.2;
  white-space: normal;
  overflow-wrap: anywhere;
}

@media (max-width: 1100px) {
  .main-sidebar {
    width: var(--sidebar-collapsed-width);
  }

  .nav-label, .sidebar-footer {
    display: none !important;
  }

  /* 窄屏折叠时左下角保留竖排图标组（头像/+/通知/私信） */
  .main-sidebar.is-collapsed .sidebar-footer {
    display: flex !important;
  }

  .nav-icon {
    margin-right: 0 !important;
  }

  .nav-item {
    justify-content: center !important;
    padding: 0 !important;
  }

  .nav-badge {
    position: absolute;
    top: 4px;
    right: 5px;
    min-width: 14px;
    height: 14px;
    padding: 0 3px;
    line-height: 14px;
  }
}

@media (max-width: 720px) {
  .mobile-sidebar-backdrop {
    position: fixed;
    /* 顶栏/底栏会因为安全区变高，遮罩按真实高度让位。 */
    inset: calc(var(--mobile-topbar-height) + env(safe-area-inset-top, 0px))
      0
      calc(var(--mobile-bottom-nav-height) + env(safe-area-inset-bottom, 0px));
    z-index: 1000;
    display: block;
    padding: 0;
    border: 0;
    background: rgba(15, 23, 42, 0.3);
    touch-action: manipulation;
  }

  .mobile-sidebar-backdrop.has-window-controls {
    top: calc(var(--mobile-window-controls-height) + var(--mobile-topbar-height));
  }
}
</style>
