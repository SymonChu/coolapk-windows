<template>
  <!--
    顶栏右上角账号入口（2026-10-07 界面稿 v4 复审：从左上角品牌区搬回来）：
    已登录 = 个人头像（点击进个人主页）；未登录 = 默认头像（点击打开登录弹窗）。
    鼠标悬停弹出资料浮层（名字/等级/经验条/签名/获赞·关注·粉丝/快捷菜单），
    浮层逻辑与样式沿用原左上角品牌区实现（BrandAccount.vue），改为向下、右对齐弹出。
  -->
  <div
    class="account-entry"
    data-tauri-drag-region="false"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <button
      type="button"
      class="account-entry-trigger"
      :title="authStore.isLoggedIn ? '个人中心' : '点击登录酷安'"
      :aria-label="authStore.isLoggedIn ? '个人中心' : '点击登录酷安'"
      @click="handleUserClick"
    >
      <AppAvatar :src="authStore.user?.userAvatar" size="sm" class="account-avatar" />
    </button>

    <Transition name="popover-fade">
      <div
        v-if="isPopoverVisible"
        class="user-profile-popover"
        @mouseenter="handleMouseEnter"
        @mouseleave="handleMouseLeave"
      >
        <!-- 已登录状态浮层 -->
        <template v-if="authStore.isLoggedIn && authStore.user">
          <div class="popover-header">
            <div class="popover-user-row">
              <AppAvatar :src="authStore.user.userAvatar" size="md" class="popover-avatar" />
              <div class="popover-user-info">
                <div class="popover-username-row">
                  <span class="popover-username">{{ authStore.user.username }}</span>
                  <span class="popover-level">Lv.{{ authStore.user.level || 1 }}</span>
                </div>

                <!-- 经验升级进度条 + 实际数字 -->
                <div class="exp-row">
                  <div class="exp-progress-bar">
                    <div class="exp-progress-fill" :style="{ width: `${getExpPercent(authStore.user)}%` }"></div>
                  </div>
                  <span class="exp-num-text">{{ getExpCurrent(authStore.user) }}/{{ getExpMax(authStore.user) }}</span>
                </div>

                <!-- 签名 -->
                <p class="popover-bio" :title="authStore.user.bio">
                  <i class="fas fa-pen bio-icon"></i>
                  <span class="bio-text">{{ authStore.user.bio || '点击设置我的签名' }}</span>
                </p>
              </div>
            </div>

            <!-- 获赞 · 关注 · 粉丝 核心数据列 (关注 & 粉丝均支持定向精准跳转) -->
            <div class="popover-stats-row">
              <div class="stat-col">
                <span class="stat-num">{{ formatNum(authStore.user.likenum) }}</span>
                <span class="stat-text">获赞</span>
              </div>
              <div class="stat-col clickable" title="查看我关注的人" @click="handleMenuClick('/following?tab=users')">
                <span class="stat-num">{{ formatNum(authStore.user.follow) }}</span>
                <span class="stat-text">关注</span>
              </div>
              <div class="stat-col clickable" title="查看我的粉丝" @click="handleMenuClick('/following?tab=fans')">
                <span class="stat-num">{{ formatNum(authStore.user.fans) }}</span>
                <span class="stat-text">粉丝</span>
              </div>
            </div>
          </div>

          <div class="popover-divider"></div>

          <div class="popover-menu">
            <button class="popover-menu-item" @click="handleMenuClick('/user/me')">
              <i class="fas fa-user-circle menu-icon"></i>
              <span>个人主页</span>
            </button>
            <button class="popover-menu-item" @click="handleMenuClick('/favorites')">
              <i class="far fa-bookmark menu-icon"></i>
              <span>我的收藏</span>
            </button>
            <button class="popover-menu-item" @click="handleMenuClick('/history')">
              <i class="far fa-clock menu-icon"></i>
              <span>浏览历史</span>
            </button>
            <button class="popover-menu-item" @click="handleMenuClick('/settings')">
              <i class="fas fa-cog menu-icon"></i>
              <span>应用设置</span>
            </button>
          </div>

          <div class="popover-divider"></div>

          <div class="popover-footer">
            <button class="popover-logout-btn" @click="handleLogout">
              <i class="fas fa-sign-out-alt"></i>
              <span>退出当前账号</span>
            </button>
          </div>
        </template>

        <!-- 未登录状态浮层 -->
        <template v-else>
          <div class="popover-guest">
            <div class="guest-icon-box">
              <i class="fas fa-user-shield"></i>
            </div>
            <span class="guest-title">未登录酷安账号</span>
            <span class="guest-desc">登录后即可发表动态、参与评论互动</span>
            <AppButton variant="primary" size="sm" class="guest-login-btn" @click="handleGuestLogin">
              <i class="fas fa-sign-in-alt"></i> 登录账号
            </AppButton>
          </div>
        </template>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth';
import { CoolapkTauriAPI } from '../../api/coolapk';
import AppButton from '../common/AppButton.vue';
import AppAvatar from '../common/AppAvatar.vue';

const router = useRouter();
const authStore = useAuthStore();

const isPopoverVisible = ref(false);
let popoverHideTimer: ReturnType<typeof setTimeout> | null = null;

async function fetchUserDetailStats() {
  if (!authStore.isLoggedIn || !authStore.user?.uid) return;
  try {
    const res: any = await CoolapkTauriAPI.getPublicUserSpace(String(authStore.user.uid));
    const data = res?.data || res || {};
    authStore.updateProfileStats({
      ...data,
      ...(data.userInfo || {})
    });
  } catch (e) {
    console.warn('获取用户详细统计数据失败:', e);
  }
}

function formatNum(n?: number): string {
  if (!n) return '0';
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万';
  return String(n);
}

function getExpCurrent(u: any): number {
  if (!u) return 0;
  return Number(u.exp ?? u.experience ?? u.userExperience ?? 0);
}

function getExpMax(u: any): number {
  if (!u) return 100;
  const level = Number(u.level || 1);
  const max = Number(u.maxExp ?? u.nextLevelExperience ?? u.next_level_experience ?? 0);
  if (max > 0) return max;
  const levelMap = [0, 50, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
  return levelMap[level] || (level * 100);
}

function getExpPercent(u: any): number {
  const current = getExpCurrent(u);
  const max = getExpMax(u);
  if (max <= 0) return 0;
  const pct = Math.round((current / max) * 100);
  return Math.min(100, Math.max(0, pct));
}

function handleMouseEnter() {
  if (popoverHideTimer) clearTimeout(popoverHideTimer);
  isPopoverVisible.value = true;
  void fetchUserDetailStats();
}

function handleMouseLeave() {
  if (popoverHideTimer) clearTimeout(popoverHideTimer);
  popoverHideTimer = setTimeout(() => {
    isPopoverVisible.value = false;
  }, 220);
}

function handleMenuClick(path: string) {
  isPopoverVisible.value = false;
  router.push(path);
}

function handleGuestLogin() {
  isPopoverVisible.value = false;
  authStore.openLoginModal();
}

function handleLogout() {
  isPopoverVisible.value = false;
  authStore.logout();
}

function handleUserClick() {
  if (authStore.isLoggedIn) {
    router.push('/user/me');
  } else {
    authStore.openLoginModal();
  }
}
</script>

<style scoped>
.account-entry {
  position: relative;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.account-entry-trigger {
  display: flex;
  align-items: center;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: var(--radius-pill);
  transition: box-shadow var(--duration-fast) var(--ease-default), transform var(--duration-fast) var(--ease-default);
}

.account-entry-trigger:hover {
  transform: scale(1.06);
  box-shadow: 0 0 0 2px var(--brand-soft);
}

.account-avatar {
  flex: 0 0 auto;
}

/* 浮层：向下弹出、右对齐（右上角锚点） */
.user-profile-popover {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  width: 270px;
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-dropdown, 0 10px 30px rgba(0, 0, 0, 0.15));
  padding: 16px;
  z-index: 1000;
  cursor: default;
}

.popover-header {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.popover-user-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.popover-avatar {
  flex-shrink: 0;
}

.popover-user-info {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  gap: 4px;
}

.popover-username-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.popover-username {
  font-size: 16px;
  font-weight: 750;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.popover-level {
  font-size: 10px;
  background: linear-gradient(135deg, #2fa06f 0%, #26815e 100%);
  color: #ffffff;
  padding: 1px 6px;
  border-radius: var(--radius-pill);
  font-weight: 800;
  font-style: italic;
  box-shadow: 0 1px 4px rgba(47, 160, 111, 0.35);
}

.exp-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}

.exp-progress-bar {
  width: 68px;
  height: 4px;
  background-color: var(--background-secondary, rgba(0, 0, 0, 0.08));
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
}

.exp-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #2fa06f 0%, #3b82f6 100%);
  border-radius: 4px;
  transition: width var(--duration-normal) var(--ease-default);
}

.exp-num-text {
  font-size: 11px;
  color: var(--text-tertiary);
  font-family: var(--font-family-base);
  font-weight: 550;
  white-space: nowrap;
}

.popover-bio {
  font-size: 12px;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 2px;
  margin-bottom: 0;
}

.bio-icon {
  font-size: 10px;
  opacity: 0.7;
  flex-shrink: 0;
}

.bio-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.popover-stats-row {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 6px 0;
}

.stat-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  cursor: default;
}

.stat-col.clickable {
  cursor: pointer;
}

.stat-col.clickable:hover .stat-num,
.stat-col.clickable:hover .stat-text {
  color: var(--brand-primary);
}

.stat-num {
  font-size: 16px;
  font-weight: 750;
  color: var(--text-primary);
  line-height: 1.2;
}

.stat-text {
  font-size: 11px;
  color: var(--text-tertiary);
}

.popover-divider {
  height: 1px;
  background-color: var(--border-light);
  margin: 10px 0;
}

.popover-menu {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.popover-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: background-color var(--duration-fast), color var(--duration-fast);
  width: 100%;
}

.popover-menu-item:hover {
  background-color: var(--surface-hover);
  color: var(--brand-primary);
}

.menu-icon {
  font-size: 14px;
  width: 16px;
  text-align: center;
  color: var(--text-tertiary);
  transition: color var(--duration-fast);
}

.popover-menu-item:hover .menu-icon {
  color: var(--brand-primary);
}

.popover-footer {
  display: flex;
}

.popover-logout-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  color: var(--danger);
  font-size: 13px;
  cursor: pointer;
  width: 100%;
  transition: background-color var(--duration-fast);
}

.popover-logout-btn:hover {
  background-color: rgba(240, 68, 68, 0.1);
}

.popover-guest {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 6px 0;
}

.guest-icon-box {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background-color: var(--brand-soft);
  color: var(--brand-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  margin-bottom: 8px;
}

.guest-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.guest-desc {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 4px;
  margin-bottom: 12px;
}

.guest-login-btn {
  width: 100%;
}

.popover-fade-enter-active,
.popover-fade-leave-active {
  transition: opacity 0.18s cubic-bezier(0.16, 1, 0.3, 1), transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.popover-fade-enter-from,
.popover-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
