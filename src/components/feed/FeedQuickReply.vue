<template>
  <!-- 快捷回复：不打开评论页，直接在动态下方回复 -->
  <div v-if="visible" class="quick-reply" @click.stop>
    <div class="qr-avatar">
      <!--
        头像必须走 AppAvatar（AppImage → Tauri 取图管线）：
        酷安返回的头像地址常是 http://，而窗口 CSP 只允许 img-src 'self' data: https:，
        裸 <img> 直连会被拦掉、显示成裂图；走管线还会把 http 升级成 https、
        带上必要请求头并命中本地缓存，失败时退回默认头像。
      -->
      <AppAvatar :src="authStore.user?.userAvatar" :size="22" />
    </div>
    <input
      v-model="draft"
      class="qr-input"
      type="text"
      autocomplete="off"
      spellcheck="false"
      :placeholder="placeholder"
      :disabled="sending"
      @keydown.enter.prevent="submit()"
    />
    <button
      type="button"
      class="qr-plus"
      title="发送「+1」"
      :disabled="sending"
      @click="sendPlusOne()"
    >+1</button>
    <button
      type="button"
      class="qr-send"
      :disabled="sending || !draft.trim()"
      @click="submit()"
    >{{ sending ? '发送中' : '发送' }}</button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { useAuthStore } from '../../stores/auth';
import { useSettingsStore } from '../../stores/settings';
import { showToast } from '../../utils/toast';
import { getErrorMessage } from '../../utils/errors';
import { isRiskControlError, openShuzilmGuide } from '../../utils/shuzilmDeviceGuide';
import AppAvatar from '../common/AppAvatar.vue';
import type { FeedItem } from '../../types/feed';

const props = withDefaults(defineProps<{
  feed: FeedItem;
  /** 详情页里评论区就在下面，隐藏快捷回复避免重复入口。 */
  detailMode?: boolean;
}>(), {
  detailMode: false,
});

const emit = defineEmits<{
  (e: 'replied', feedId: string | number): void;
}>();

const authStore = useAuthStore();
const settingsStore = useSettingsStore();
const draft = ref('');
const sending = ref(false);

const feedId = computed(() => String(props.feed?.id ?? props.feed?.entityId ?? ''));
const authorName = computed(() => String(
  props.feed?.username || props.feed?.userInfo?.username || '酷友',
));
const visible = computed(() => settingsStore.settings.quickReplyEnabled !== false
  && !props.detailMode
  && Boolean(feedId.value));
const placeholder = computed(() => `回复 ${authorName.value}…（不打开评论页，直接回）`);

function requireLogin(): boolean {
  if (authStore.isLoggedIn) return true;
  authStore.openLoginModal();
  return false;
}

async function send(message: string, successText: string) {
  if (!requireLogin() || sending.value) return;
  sending.value = true;
  try {
    await CoolapkTauriAPI.replyFeed(feedId.value, message);
    showToast(successText);
    if (message === draft.value.trim()) draft.value = '';
    emit('replied', props.feed.id);
  } catch (err) {
    if (isRiskControlError(err)) {
      showToast('酷安服务端风控拦截（需官方设备认证），发表失败', 'error');
      openShuzilmGuide({
        reason: 'risk_controlled',
        message: '请求被酷安服务端拦截。请到设备信息设置粘贴手机官方酷安复制的设备日志，保存后重试。',
        onConfirmContinue: () => {
          void send(message, successText);
        },
      });
      return;
    }
    showToast(getErrorMessage(err, '回复失败，请稍后再试'), 'error');
  } finally {
    sending.value = false;
  }
}

function submit() {
  const text = draft.value.trim();
  if (!text) {
    showToast('先写点什么吧', 'info');
    return;
  }
  void send(text, '回复成功');
}

function sendPlusOne() {
  void send('+1', '已发送 +1');
}
</script>

<style scoped>
.quick-reply {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 0 12px;
}

.qr-avatar {
  flex: 0 0 22px;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.qr-input {
  flex: 1 1 auto;
  min-width: 0;
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--border-light, rgba(0, 0, 0, 0.08));
  border-radius: 15px;
  background: var(--surface-hover, #fafbfc);
  color: var(--text-primary);
  font-size: 12.5px;
  font-family: inherit;
  outline: none;
  transition: border-color var(--duration-fast, 0.15s) var(--ease-default, ease);
}

.qr-input:focus {
  border-color: var(--brand-primary);
}

.qr-input::placeholder {
  color: var(--text-tertiary);
}

.qr-plus,
.qr-send {
  flex: 0 0 auto;
  height: 26px;
  border-radius: 13px;
  border: 1px solid var(--border-light, rgba(0, 0, 0, 0.08));
  background: var(--surface);
  color: var(--text-secondary);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  padding: 0 10px;
  transition: color var(--duration-fast, 0.15s) var(--ease-default, ease),
    background-color var(--duration-fast, 0.15s) var(--ease-default, ease);
}

.qr-plus:hover:not(:disabled) {
  color: var(--brand-primary);
  border-color: var(--brand-primary);
}

.qr-send {
  border-color: transparent;
  background: var(--brand-primary);
  color: #fff;
  font-weight: 600;
  min-width: 52px;
}

.qr-send:hover:not(:disabled) {
  filter: brightness(0.94);
}

.qr-plus:disabled,
.qr-send:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
</style>
