<template>
  <!--
    顶栏右上角动作区：通知、私信。
    2026-10-07（界面稿 v4）：从侧栏左下角搬回顶栏右侧；账号触发器与资料浮层
    拆到左上角品牌区（BrandAccount.vue），左下角保留个人中心卡片；
    发布按钮改为首页底部居中的悬浮按钮（components/layout/PublishFab.vue）。
    浮层向下弹出：定位锚点是本容器，样式里把 popover 的 top 锚到图标下方。
  -->
  <div class="top-bar-actions" data-tauri-drag-region="false">
      <div
        class="notification-wrapper"
        @mouseenter="handleNotificationMouseEnter"
        @mouseleave="handleNotificationMouseLeave"
      >
        <AppIconButton
          icon="fas fa-bell"
          :title="notificationStore.notificationCount > 0 ? `${notificationStore.notificationCount} 条未读通知` : '通知'"
          aria-label="通知"
          :badge="notificationStore.notificationCount"
          @click="openNotificationCenter"
        />

        <Transition name="popover-fade">
          <div
            v-if="isNotificationPopoverVisible"
            class="notification-popover"
            @mouseenter="handleNotificationMouseEnter"
            @mouseleave="handleNotificationMouseLeave"
          >
            <div class="notification-popover-header">
              <div>
                <strong>通知</strong>
                <span v-if="notificationStore.notificationCount > 0">
                  {{ notificationStore.notificationCount }} 条未读
                </span>
              </div>
              <button type="button" @click="openNotificationCenter">查看全部</button>
            </div>

            <div v-if="notificationPreviewLoading" class="notification-popover-state">
              <i class="fas fa-circle-notch fa-spin"></i>
              <span>正在加载通知...</span>
            </div>
            <div v-else-if="notificationPreviews.length === 0" class="notification-popover-state">
              <i class="far fa-bell-slash"></i>
              <span>暂无未读通知</span>
            </div>
            <div v-else class="notification-preview-list">
              <button
                v-for="preview in notificationPreviews"
                :key="preview.key"
                type="button"
                class="notification-preview-item"
                @click="openNotificationPreview(preview)"
              >
                <AppAvatar :src="getNotificationPreviewAvatar(preview)" size="sm" />
                <span class="notification-preview-content">
                  <span class="notification-preview-meta">
                    <strong>{{ getNotificationPreviewUsername(preview) }}</strong>
                    <em>{{ preview.label }}</em>
                  </span>
                  <span class="notification-preview-text">{{ getNotificationPreviewText(preview) }}</span>
                </span>
                <i class="fas fa-chevron-right"></i>
              </button>
            </div>
          </div>
        </Transition>
      </div>

      <div
        class="message-wrapper"
        @mouseenter="handleMessageMouseEnter"
        @mouseleave="handleMessageMouseLeave"
      >
        <AppIconButton
          icon="fas fa-envelope"
          :title="notificationStore.messageCount > 0 ? `${notificationStore.messageCount} 条未读私信` : '私信'"
          aria-label="私信"
          :badge="notificationStore.messageCount"
          @click="openMessagesPage"
        />

        <Transition name="popover-fade">
          <div
            v-if="isMessagePopoverVisible"
            class="notification-popover message-popover"
            @mouseenter="handleMessageMouseEnter"
            @mouseleave="handleMessageMouseLeave"
          >
            <div class="notification-popover-header">
              <div>
                <strong>私信</strong>
                <span v-if="notificationStore.messageCount > 0">
                  {{ notificationStore.messageCount }} 条未读
                </span>
              </div>
              <button type="button" @click="openMessagesPage">查看全部</button>
            </div>

            <div v-if="messagePreviewLoading" class="notification-popover-state">
              <i class="fas fa-circle-notch fa-spin"></i>
              <span>正在加载私信...</span>
            </div>
            <div v-else-if="messagePreviews.length === 0" class="notification-popover-state">
              <i class="far fa-envelope-open"></i>
              <span>暂无未读私信</span>
            </div>
            <div v-else class="message-preview-list">
              <button
                v-for="preview in messagePreviews"
                :key="preview.key"
                type="button"
                class="notification-preview-item message-preview-item"
                @click="openMessagePreview(preview)"
              >
                <AppAvatar :src="getMessagePreviewAvatar(preview)" size="sm" />
                <span class="notification-preview-content">
                  <span class="message-preview-meta">
                    <strong>{{ getMessagePreviewUsername(preview) }}</strong>
                    <em>{{ getMessagePreviewTime(preview) }}</em>
                  </span>
                  <span class="notification-preview-text">{{ getMessagePreviewText(preview) }}</span>
                </span>
                <span class="message-preview-badge">{{ getMessagePreviewUnreadLabel(preview) }}</span>
              </button>
            </div>
          </div>
        </Transition>
      </div>
  </div>
</template>

<script setup lang="ts">

import { computed, ref, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth';
import { useNotificationStore } from '../../stores/notifications';
import { useSettingsStore } from '../../stores/settings';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { androidNotificationContent } from '../../utils/androidNotificationContent';
import { desktopNotify } from '../../utils/desktopNotify';
import {
  getNotificationCategoryCountsFromItems,
  hasNotificationCountIncreased,
  type NotificationCategory,
} from '../../utils/notificationCount';
import { getMessageUnreadCount, getSelfMessageUnreadCount } from '../../utils/messageUnread';
import { getNotificationActor } from '../../utils/notificationItem';
import {
  addSeenNotificationCount,
  clearSeenNotificationState,
  hasSeenNotificationItems,
  markNotificationItemsSeen,
  takeSeenNotificationCount,
} from '../../utils/notificationSeen';
import { getNotificationExternalUrl, getNotificationFeedId, resolveNotificationTargetRoute } from '../../utils/notificationNavigation';
import { syncWindowsNotificationIcons } from '../../utils/taskbarNotificationDot';
import { openFeedDetail } from '../../utils/feedNavigation';
import AppIconButton from '../common/AppIconButton.vue';
import AppAvatar from '../common/AppAvatar.vue';

const router = useRouter();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();
const settingsStore = useSettingsStore();


const NOTIFICATION_POLL_MIN_INTERVAL_MS = 60 * 1000;
const NOTIFICATION_POLL_MAX_BACKOFF_MS = 10 * 60 * 1000;
let notifTimer: ReturnType<typeof setTimeout> | null = null;
let notificationRequestRunning = false;
let notificationPollFailureCount = 0;
let notificationPollingActive = false;

interface NotificationPreview {
  key: string;
  apiType: string;
  category: NotificationCategory;
  label: string;
  item: any;
}

interface MessagePreview {
  key: string;
  item: any;
  unreadCount: number;
}

const notificationPreviewSources: Array<{
  apiType: string;
  category: NotificationCategory;
  label: string;
}> = [
  { apiType: 'list', category: 'comment', label: '评论回复' },
  { apiType: 'atMeList', category: 'atMe', label: '@ 提及' },
  { apiType: 'atCommentMeList', category: 'atComment', label: '评论 @' },
  { apiType: 'feedLikeList', category: 'like', label: '收到的赞' },
  { apiType: 'contactsFollowList', category: 'follow', label: '新关注' },
];

const isNotificationPopoverVisible = ref(false);
const notificationPreviewLoading = ref(false);
const notificationPreviews = ref<NotificationPreview[]>([]);
let notificationPopoverHideTimer: ReturnType<typeof setTimeout> | null = null;
let notificationPreviewLoadedAt = 0;
let restoredSeenLikeUid = '';
let restoringSeenLikes = false;
const isMessagePopoverVisible = ref(false);
const messagePreviewLoading = ref(false);
const messagePreviews = ref<MessagePreview[]>([]);
let messagePopoverHideTimer: ReturnType<typeof setTimeout> | null = null;
let messagePreviewLoadedAt = 0;

function isDesktopNotificationEnabledFor(categories: NotificationCategory[]): boolean {
  if (!settingsStore.settings.desktopNotifications) return false;
  if (categories.length === 0) {
    return settingsStore.settings.notifyReplies
      || settingsStore.settings.notifyAt
      || settingsStore.settings.notifyPm;
  }
  return categories.some((category) => {
    if (category === 'comment') return settingsStore.settings.notifyReplies;
    if (category === 'atMe' || category === 'atComment') return settingsStore.settings.notifyAt;
    if (category === 'message') return settingsStore.settings.notifyPm;
    // 收到的赞和新关注目前没有独立开关，开启桌面通知后默认提醒。
    return category === 'like' || category === 'follow';
  });
}

/**
 * 服务端没有单独清除点赞未读的已知类型。启动后恢复本机保存的已读数量，
 * 仅抵消这部分旧 badge，服务端总数归零时会自动清除本机记录。
 */
async function restoreSeenLikeNotifications(): Promise<number> {
  const uid = String(authStore.user?.uid || '').trim();
  if (!uid || restoredSeenLikeUid === uid || restoringSeenLikes || notificationStore.notificationCount <= 0) {
    return 0;
  }

  restoringSeenLikes = true;
  try {
    let remaining = takeSeenNotificationCount(uid, 'like', notificationStore.notificationCount);
    // 兼容上一版已经保存了通知标识、但尚未保存数量的用户；当前旧标识至少抵消一条。
    if (remaining === 0 && hasSeenNotificationItems(uid, 'like')) {
      remaining = Math.min(1, notificationStore.notificationCount);
      if (remaining > 0) addSeenNotificationCount(uid, 'like', remaining);
    }
    const restoredCount = remaining;

    while (remaining > 0 && notificationStore.categoryCounts.like > 0) {
      if (!notificationStore.markViewed('like')) break;
      remaining -= 1;
    }
    if (remaining > 0) notificationStore.suppressNotificationCount(remaining);
    return restoredCount;
  } finally {
    restoringSeenLikes = false;
    restoredSeenLikeUid = uid;
  }
}

async function fetchNotificationCount(): Promise<boolean | null> {
  if (!authStore.isLoggedIn) {
    notificationStore.reset();
    return true;
  }
  if (notificationRequestRunning) return null;
  notificationRequestRunning = true;
  const requestStateVersion = notificationStore.notificationStateVersion;
  try {
    const res: any = await CoolapkTauriAPI.getNotificationCount();
    // 清除通知期间返回的旧 checkCount 不能再写回红点，否则本地刚消失的角标会被竞态恢复。
    if (requestStateVersion !== notificationStore.notificationStateVersion) return true;
    const previousMessageCount = notificationStore.messageCount;
    const applied = notificationStore.applyServerResponse(res);
    let { previous, count, increasedCategories } = applied;

    await restoreSeenLikeNotifications();
    if (requestStateVersion !== notificationStore.notificationStateVersion) return true;
    count = notificationStore.unreadCount;

    // checkCount 只返回数量，服务端偶尔会把自己发出的最后一条私信也算进去。
    // 用会话列表中的发送者字段校正 message 分类后，再决定是否弹桌面提醒。
    if (notificationStore.messageCount > 0) {
      try {
        const messageResponse = await CoolapkTauriAPI.listMessages(1);
        const messageSessions = Array.isArray(messageResponse?.data) ? messageResponse.data : [];
        notificationStore.suppressMessageCount(
          getSelfMessageUnreadCount(messageSessions, authStore.user?.uid),
        );
        if (notificationStore.messageCount <= previousMessageCount) {
          increasedCategories = increasedCategories.filter((category) => category !== 'message');
        }
        count = notificationStore.unreadCount;
      } catch (error) {
        // 会话列表失败时保留服务端原始计数，避免误把真实私信吞掉。
        console.warn('校正私信未读方向失败:', error);
      }
    }

    const countIncreased = hasNotificationCountIncreased(previous, count);
    // 首次请求只建立基线；之后即使基线为零，第一条新通知也会触发提醒。
    if (
      countIncreased &&
      isDesktopNotificationEnabledFor(increasedCategories)
    ) {
      void desktopNotify(
        /android/i.test(navigator.userAgent) ? await androidNotificationContent(increasedCategories.filter(category => isDesktopNotificationEnabledFor([category])), String(authStore.user?.uid || ''), count) : {
          title: '酷安新通知',
          body: `你有 ${count} 条未读通知，点击查看详情。`,
        },
        settingsStore.settings.notificationSound
      );
    }
    if (countIncreased) {
      notificationPreviewLoadedAt = 0;
      if (increasedCategories.includes('message')) {
        messagePreviewLoadedAt = 0;
        if (isMessagePopoverVisible.value) void fetchMessagePreviews(true);
      }
      const detail = { previous, count, increasedCategories };
      window.dispatchEvent(new CustomEvent('coolapk-notification-count-increased', { detail }));
      if (increasedCategories.includes('message')) {
        window.dispatchEvent(new CustomEvent('coolapk-message-count-increased', { detail }));
      }
    }
    return true;
  } catch (e) {
    console.warn('获取通知未读数失败:', e);
    return false;
  } finally {
    notificationRequestRunning = false;
  }
}

function getNotificationItemTime(item: any): number {
  const value = Number(item?.likeTime ?? item?.dateline ?? item?.createTime ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function stripNotificationHtml(value: unknown): string {
  return String(value || '').replace(/<[^>]+>/g, '').trim();
}

function getNotificationPreviewAvatar(preview: NotificationPreview): string {
  return getNotificationActor(preview.item, preview.category).avatar;
}

function getNotificationPreviewUsername(preview: NotificationPreview): string {
  return getNotificationActor(preview.item, preview.category).username;
}

function getNotificationPreviewText(preview: NotificationPreview): string {
  const item = preview.item;
  if (preview.category === 'like') {
    const target = stripNotificationHtml(item?.feedTypeName || item?.infoHtml || '动态');
    return `赞了你的${target}`;
  }
  return stripNotificationHtml(
    item?.note
    || item?.message
    || item?.message_title
    || item?.feedInfo?.message_title
    || item?.feedInfo?.message
    || '点击查看通知详情'
  );
}

async function fetchNotificationPreviews(force = false) {
  if (!authStore.isLoggedIn || notificationPreviewLoading.value) return;
  if (!force && Date.now() - notificationPreviewLoadedAt < 30_000) return;
  notificationPreviewLoading.value = true;
  try {
    const sourcesWithUnread = notificationPreviewSources.filter(
      (source) => notificationStore.categoryCounts[source.category] > 0
    );
    const sources = sourcesWithUnread.length > 0
      ? sourcesWithUnread
      : notificationStore.notificationCount > 0
        ? notificationPreviewSources
        : [];
    const responses = await Promise.all(sources.map(async (source) => {
      try {
        const response = await CoolapkTauriAPI.getNotifications(source.apiType, 1);
        const data = Array.isArray(response?.data) ? response.data : [];
        const recoveredCounts = getNotificationCategoryCountsFromItems(data);
        for (const [category, count] of Object.entries(recoveredCounts) as Array<[NotificationCategory, number]>) {
          notificationStore.applyCategoryCount(category, count);
        }
        const limit = Math.max(1, Math.min(notificationStore.categoryCounts[source.category] || 1, 3));
        return data.slice(0, limit).map((item: any, index: number): NotificationPreview => ({
          key: `${source.apiType}:${item?.id || item?.likeTime || item?.dateline || index}`,
          ...source,
          item,
        }));
      } catch {
        return [];
      }
    }));
    const previewLimit = Math.max(1, Math.min(notificationStore.notificationCount, 5));
    notificationPreviews.value = responses
      .flat()
      .sort((a, b) => getNotificationItemTime(b.item) - getNotificationItemTime(a.item))
      .slice(0, previewLimit);

    // 部分账号的 checkCount 和列表项都不带 feedlike 等分类字段，但这里已经通过
    // 实际命中的接口确定了未读来源。全局只剩一条且只有一个预览时，可安全归属给它，
    // 让“收到的赞”Tab 与左侧红点保持一致。
    const knownCategoryCount = notificationPreviewSources.reduce(
      (total, source) => total + notificationStore.categoryCounts[source.category],
      0,
    );
    if (
      notificationStore.notificationCount - knownCategoryCount === 1
      && notificationPreviews.value.length === 1
    ) {
      const preview = notificationPreviews.value[0];
      if (notificationStore.categoryCounts[preview.category] === 0) {
        notificationStore.applyCategoryCount(preview.category, 1);
      }
    }
    notificationPreviewLoadedAt = Date.now();
  } finally {
    notificationPreviewLoading.value = false;
  }
}

function getMessagePreviewPartnerUid(preview: MessagePreview): string {
  const item = preview.item;
  return String(item?.messageUid || item?.fromuid || item?.uid || '').trim();
}

function getMessagePreviewUsername(preview: MessagePreview): string {
  const item = preview.item;
  return item?.messageUsername
    || item?.fromusername
    || item?.username
    || item?.messageUserInfo?.username
    || '未知酷友';
}

function getMessagePreviewAvatar(preview: MessagePreview): string {
  const item = preview.item;
  return item?.messageUserAvatar
    || item?.fromUserAvatar
    || item?.messageUserInfo?.userAvatar
    || item?.fromUserInfo?.userAvatar
    || item?.userAvatar
    || '';
}

function getMessagePreviewText(preview: MessagePreview): string {
  const item = preview.item;
  return stripNotificationHtml(item?.message || item?.lastMessage || item?.summary || item?.last_message || '暂无消息');
}

function getMessagePreviewUnreadLabel(preview: MessagePreview): string {
  return preview.unreadCount > 99 ? '99+' : String(preview.unreadCount);
}

function getMessagePreviewTime(preview: MessagePreview): string {
  const timestamp = getNotificationItemTime(preview.item);
  if (!timestamp) return '';
  const date = new Date(timestamp > 9_999_999_999 ? timestamp : timestamp * 1000);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

function getMessagePreviewUnreadCount(item: any): number {
  return getMessageUnreadCount(item, authStore.user?.uid);
}

async function fetchMessagePreviews(force = false) {
  if (!authStore.isLoggedIn || messagePreviewLoading.value) return;
  if (!force && Date.now() - messagePreviewLoadedAt < 10_000) return;
  messagePreviewLoading.value = true;
  try {
    const response = await CoolapkTauriAPI.listMessages(1);
    const data = Array.isArray(response?.data) ? response.data : [];
    notificationStore.suppressMessageCount(
      getSelfMessageUnreadCount(data, authStore.user?.uid),
    );
    const previews: MessagePreview[] = data
      .map((item: any, index: number): MessagePreview => ({
        key: String(item?.messageUid || item?.fromuid || item?.uid || item?.ukey || item?.id || index),
        item,
        unreadCount: getMessagePreviewUnreadCount(item),
      }));
    messagePreviews.value = previews
      .filter((preview: MessagePreview) => preview.unreadCount > 0)
      .sort((a: MessagePreview, b: MessagePreview) => getNotificationItemTime(b.item) - getNotificationItemTime(a.item))
      .slice(0, 6);
    messagePreviewLoadedAt = Date.now();
  } catch (error) {
    console.warn('获取私信预览失败:', error);
    messagePreviews.value = [];
  } finally {
    messagePreviewLoading.value = false;
  }
}

function handleNotificationMouseEnter() {
  if (notificationPopoverHideTimer) clearTimeout(notificationPopoverHideTimer);
  isNotificationPopoverVisible.value = true;
  void fetchNotificationPreviews();
}

function handleNotificationMouseLeave() {
  if (notificationPopoverHideTimer) clearTimeout(notificationPopoverHideTimer);
  notificationPopoverHideTimer = setTimeout(() => {
    isNotificationPopoverVisible.value = false;
  }, 220);
}

function handleMessageMouseEnter() {
  if (messagePopoverHideTimer) clearTimeout(messagePopoverHideTimer);
  isMessagePopoverVisible.value = true;
  void fetchMessagePreviews();
}

function handleMessageMouseLeave() {
  if (messagePopoverHideTimer) clearTimeout(messagePopoverHideTimer);
  messagePopoverHideTimer = setTimeout(() => {
    isMessagePopoverVisible.value = false;
  }, 220);
}

function openMessagePopover() {
  if (messagePopoverHideTimer) clearTimeout(messagePopoverHideTimer);
  isMessagePopoverVisible.value = true;
  void fetchMessagePreviews();
}

function openMessagesPage() {
  isMessagePopoverVisible.value = false;
  void router.push('/messages');
}

function openMessagePreview(preview: MessagePreview) {
  const uid = getMessagePreviewPartnerUid(preview);
  isMessagePopoverVisible.value = false;
  if (!uid) {
    void router.push('/messages');
    return;
  }
  void router.push({ path: '/messages', query: { uid, open: String(Date.now()) } });
}

function openNotificationCenter() {
  isNotificationPopoverVisible.value = false;
  void router.push('/notifications');
}

async function openNotificationPreview(preview: NotificationPreview) {
  const viewed = notificationStore.markViewed(preview.category);
  if (viewed && preview.category === 'like' && authStore.user?.uid) {
    addSeenNotificationCount(authStore.user.uid, preview.category, 1);
    markNotificationItemsSeen(authStore.user.uid, preview.category, [preview.item], 1);
  }
  void clearFeedNotifications();
  notificationPreviews.value = notificationPreviews.value.filter((item) => item.key !== preview.key);
  isNotificationPopoverVisible.value = false;
  const externalUrl = getNotificationExternalUrl(preview.item);
  if (externalUrl) {
    void CoolapkTauriAPI.openUrl(externalUrl);
    return;
  }
  const feedId = getNotificationFeedId(preview.item);
  if (feedId) {
    openFeedDetail(router, feedId, preview.item);
    return;
  }
  const targetRoute = await resolveNotificationTargetRoute(
    preview.item,
    (name) => CoolapkTauriAPI.getProductDetailByName(name),
  );
  if (targetRoute) {
    void router.push(targetRoute);
    return;
  }
  void router.push({ path: '/notifications', query: { tab: preview.apiType } });
}

async function clearFeedNotifications(): Promise<void> {
  notificationStore.beginNotificationClear();
  try {
    // v18 服务端对 type=feed 会返回 200 但不改变 badge；官方 APK 的通知中心使用 type=all。
    // 只有在当前已知没有私信时才调用 all，保留桌面端铃铛与私信入口的分离语义。
    const clearType = notificationStore.messageCount > 0 ? 'feed' : 'all';
    await CoolapkTauriAPI.clearNotificationCount(clearType);
    notificationStore.markNotificationsCleared();
    if (authStore.user?.uid) clearSeenNotificationState(authStore.user.uid, 'like');
    notificationPreviews.value = [];
    notificationPreviewLoadedAt = 0;
  } catch (error) {
    // 保留本地即时反馈；下次轮询仍会以服务端状态为准。
    console.warn('清除服务端通知未读数失败:', error);
  }
}

function getNotificationPollIntervalMs(): number {
  if (!settingsStore.settings.desktopNotifications) return NOTIFICATION_POLL_MIN_INTERVAL_MS;
  const minutes = Math.max(1, Math.min(settingsStore.settings.notificationPollInterval || 1, 60));
  return minutes * NOTIFICATION_POLL_MIN_INTERVAL_MS;
}

function getNextNotificationPollDelayMs(): number {
  const baseInterval = getNotificationPollIntervalMs();
  const maxDelay = Math.max(baseInterval, NOTIFICATION_POLL_MAX_BACKOFF_MS);
  const backoffFactor = 2 ** Math.min(notificationPollFailureCount, 3);
  return Math.min(baseInterval * backoffFactor, maxDelay);
}

function clearNotificationPollTimer() {
  if (!notifTimer) return;
  clearTimeout(notifTimer);
  notifTimer = null;
}

function scheduleNotificationPoll(delayMs = getNextNotificationPollDelayMs()) {
  clearNotificationPollTimer();
  if (!notificationPollingActive || document.visibilityState !== 'visible') return;
  notifTimer = setTimeout(() => {
    notifTimer = null;
    void runScheduledNotificationPoll();
  }, Math.max(0, delayMs));
}

async function runScheduledNotificationPoll() {
  const result = await fetchNotificationCount();
  if (result === false) notificationPollFailureCount += 1;
  if (result === true) notificationPollFailureCount = 0;
  scheduleNotificationPoll();
}

async function pollNotificationCountNow() {
  if (!notificationPollingActive || document.visibilityState !== 'visible') return;
  clearNotificationPollTimer();
  const result = await fetchNotificationCount();
  if (result === false) notificationPollFailureCount += 1;
  if (result === true) notificationPollFailureCount = 0;
  scheduleNotificationPoll();
}

function startPolling() {
  notificationPollFailureCount = 0;
  scheduleNotificationPoll();
}

function handleWindowFocus() {
  void pollNotificationCountNow();
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    void pollNotificationCountNow();
    return;
  }
  clearNotificationPollTimer();
}

onMounted(() => {
  notificationPollingActive = true;
  startPolling();
  void pollNotificationCountNow();
  window.addEventListener('focus', handleWindowFocus);
  document.addEventListener('visibilitychange', handleVisibilityChange);
});

onUnmounted(() => {
  notificationPollingActive = false;
  clearNotificationPollTimer();
  if (notificationPopoverHideTimer) clearTimeout(notificationPopoverHideTimer);
  if (messagePopoverHideTimer) clearTimeout(messagePopoverHideTimer);
  window.removeEventListener('focus', handleWindowFocus);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
});

watch(
  () => authStore.isLoggedIn,
  () => {
    notificationPreviews.value = [];
    notificationPreviewLoadedAt = 0;
    messagePreviews.value = [];
    messagePreviewLoadedAt = 0;
    isMessagePopoverVisible.value = false;
    restoredSeenLikeUid = '';
    if (!authStore.isLoggedIn) notificationStore.reset();
    void pollNotificationCountNow();
  }
);

watch(
  () => [
    settingsStore.settings.notificationPollInterval,
    settingsStore.settings.desktopNotifications,
  ],
  () => startPolling()
);

watch(
  () => notificationStore.unreadCount,
  (unreadCount) => {
    void syncWindowsNotificationIcons(unreadCount);
  },
  { immediate: true }
);

</script>

<style scoped>
/*
 * 顶栏右上角动作区（2026-10-07 界面稿 v4）：通知 / 私信，横排。
 * 账号触发器与资料浮层在左上角 BrandAccount.vue；个人中心卡片在 MainSidebar 的 footer 里；
 * 发布按钮是首页底部悬浮按钮（PublishFab.vue）。
 */
.top-bar-actions {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.notification-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.message-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.notification-popover {
  position: absolute;
  /* 搬回顶栏后恢复向下弹出（锚在图标下方） */
  top: calc(100% + 10px);
  right: -44px;
  width: 360px;
  overflow: hidden;
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-dropdown, 0 10px 30px rgba(0, 0, 0, 0.15));
  z-index: 1000;
}

.notification-popover-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border-light);
}

.notification-popover-header > div {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}

.notification-popover-header strong {
  color: var(--text-primary);
  font-size: var(--font-size-sub);
}

.notification-popover-header span {
  color: var(--text-tertiary);
  font-size: var(--font-size-caption);
}

.notification-popover-header button {
  color: var(--brand-primary);
  font-size: var(--font-size-caption);
  cursor: pointer;
}

.notification-popover-state {
  min-height: 112px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  color: var(--text-tertiary);
  font-size: var(--font-size-caption);
}

.notification-popover-state i {
  font-size: 20px;
}

.notification-preview-list {
  display: flex;
  flex-direction: column;
  padding: var(--space-2);
}

.notification-preview-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-control);
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
}

.notification-preview-item:hover {
  background-color: var(--surface-hover);
}

.notification-preview-content {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.notification-preview-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.notification-preview-meta strong {
  overflow: hidden;
  color: var(--text-primary);
  font-size: var(--font-size-caption);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notification-preview-meta em {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  background-color: var(--brand-soft);
  color: var(--brand-primary);
  font-size: 10px;
  font-style: normal;
}

.notification-preview-text {
  overflow: hidden;
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notification-preview-item > i {
  flex-shrink: 0;
  color: var(--text-tertiary);
  font-size: 10px;
}

.message-preview-list {
  display: flex;
  flex-direction: column;
  padding: var(--space-2);
}

.message-preview-item {
  min-height: 58px;
}

.message-preview-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  min-width: 0;
}

.message-preview-meta strong {
  overflow: hidden;
  color: var(--text-primary);
  font-size: var(--font-size-caption);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message-preview-meta em {
  flex-shrink: 0;
  color: var(--text-tertiary);
  font-size: 10px;
  font-style: normal;
}

.message-preview-badge {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: var(--radius-full);
  background-color: var(--danger);
  color: #ffffff;
  font-size: 10px;
  font-weight: var(--font-weight-bold);
  line-height: 18px;
}

@media (max-width: 1100px) {
.top-bar-right :deep(.app-button .icon-left) {
    margin-right: 0;
  }
}

@media (max-width: 800px) {
.top-bar-right {
    gap: var(--space-1);
    margin-left: var(--space-1);
    margin-right: var(--space-2);
  }
}

@media (max-width: 720px) {
.top-bar-right {
    margin-right: var(--space-1);
    margin-left: 2px;
    gap: 2px;
  }
}

@media (max-width: 560px) {
  .message-wrapper {
    display: none;
  }
}

.popover-fade-enter-active,
.popover-fade-leave-active {
  transition: opacity 0.18s cubic-bezier(0.16, 1, 0.3, 1), transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.popover-fade-enter-from,
.popover-fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

</style>
