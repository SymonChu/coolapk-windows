<template>
  <AppDialog :is-open="isOpen" title="分享到看看号" :width="520" @close="$emit('close')">
    <div class="dyh-share-tabs">
      <button v-for="tab in tabs" :key="tab.type" :class="{ active: shareType === tab.type }" :disabled="sending" @click="switchTab(tab.type)">{{ tab.title }}</button>
    </div>
    <input v-model="keyword" class="dyh-share-search" placeholder="搜索看看号" aria-label="搜索看看号" />
    <LoadingState v-if="loading && !rows.length" text="加载看看号..." />
    <p v-if="error" class="dyh-share-error">{{ error }} <button v-if="needsCreate" @click="createDyh">去创建</button><button v-else :disabled="loading" @click="loadPage">重试</button></p>
    <label v-for="row in filteredRows" :key="row.id" class="dyh-share-row">
      <input v-model="selected" type="checkbox" :value="row.id" :disabled="sending" />
      <AppImage v-if="row.logo" :src="row.logo" class="dyh-share-logo" fit="cover" />
      <span>{{ row.title }}</span>
    </label>
    <p v-if="!loading && !error && !filteredRows.length">{{ rows.length ? '没有匹配的看看号' : shareType === 1 ? '暂无可收录的看看号，可切换到分享到广场' : '暂无可分享的看看号' }}</p>
    <button v-if="hasMore && !error" class="dyh-share-more" :disabled="loading || sending" @click="loadPage">{{ loading ? '加载中...' : '加载更多' }}</button>
    <template #footer>
      <button class="dyh-share-submit" :disabled="sending || !selected.length" @click="submit">{{ sending ? '提交中...' : `确定${selected.length ? `（${selected.length}）` : ''}` }}</button>
    </template>
  </AppDialog>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AppDialog from '../common/AppDialog.vue';
import AppImage from '../common/AppImage.vue';
import LoadingState from '../common/LoadingState.vue';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { getErrorMessage } from '../../utils/errors';
import { showToast } from '../../utils/toast';

const props = defineProps<{ isOpen: boolean; feedId: string }>();
const emit = defineEmits<{ (e: 'close'): void }>();
const tabs = [{ type: 1 as const, title: '收录到看看号' }, { type: 2 as const, title: '分享到广场' }];
const shareType = ref<1 | 2>(1);
const keyword = ref('');
const rows = ref<{ id: string; title: string; logo: string }[]>([]);
const selected = ref<string[]>([]);
const page = ref(1);
const hasMore = ref(false);
const loading = ref(false);
const sending = ref(false);
const error = ref('');
const needsCreate = computed(() => shareType.value === 1 && error.value.includes('没有可管理的看看号'));
function createDyh() { void CoolapkTauriAPI.openUrl('https://m.coolapk.com/mp/do?c=dyh', 'internal'); }
let generation = 0;
const filteredRows = computed(() => rows.value.filter(row => row.title.toLowerCase().includes(keyword.value.trim().toLowerCase())));
function reset() { generation++; rows.value = []; selected.value = []; keyword.value = ''; page.value = 1; hasMore.value = false; loading.value = false; error.value = ''; }
async function switchTab(type: 1 | 2) { if (sending.value || type === shareType.value) return; shareType.value = type; reset(); await loadPage(); }
async function loadPage() {
  if (loading.value) return;
  const attempt = generation;
  loading.value = true; error.value = '';
  try {
    const response = await CoolapkTauriAPI.getFeedShareDyhList(shareType.value, page.value);
    if (attempt !== generation || !props.isOpen) return;
    const data: any[] = Array.isArray(response?.data) ? response.data : [];
    const next = data.map(row => ({ id: String(row.id || row.entityId || ''), title: String(row.title || row.name || ''), logo: String(row.logo || row.avatar || '') })).filter(row => row.id && row.title);
    const existing = new Set(rows.value.map(row => row.id));
    const added = next.filter(row => !existing.has(row.id));
    rows.value.push(...added); hasMore.value = data.length >= 20 && added.length > 0; page.value++;
  } catch (err) {
    if (attempt === generation) {
      const message = getErrorMessage(err, '看看号加载失败').replace(/<[^>]*>/g, '');
      error.value = message.includes('没有可管理的看看号') ? '还没有可管理的看看号' : message;
    }
  }
  finally { if (attempt === generation) loading.value = false; }
}
async function submit() {
  if (sending.value || !selected.value.length) return;
  sending.value = true;
  try { await CoolapkTauriAPI.shareFeedToDyh(props.feedId, [...selected.value], shareType.value); showToast(shareType.value === 1 ? '收录成功' : '分享成功'); emit('close'); }
  catch (err) { showToast(getErrorMessage(err, '分享到看看号失败'), 'error'); }
  finally { sending.value = false; }
}
watch(() => [props.isOpen, props.feedId] as const, ([open]) => { reset(); if (open) { shareType.value = 1; void loadPage(); } }, { immediate: true });
</script>
<style scoped>
.dyh-share-tabs { display: flex; gap: 8px; margin-bottom: 14px; }
.dyh-share-tabs button { flex: 1; border: 0; border-radius: 22px; padding: 10px; background: var(--surface-hover); color: var(--text-secondary); font: inherit; cursor: pointer; }
.dyh-share-tabs button.active { color: var(--brand-primary); background: var(--brand-soft); }
.dyh-share-search { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); color: var(--text-primary); font: inherit; }
.dyh-share-row { display: flex; align-items: center; gap: 12px; padding: 12px 0; cursor: pointer; }
.dyh-share-logo { width: 36px; height: 36px; border-radius: 8px; }
.dyh-share-submit { width: 100%; border: 0; padding: 12px; border-radius: 24px; background: var(--brand-primary); color: white; font: inherit; cursor: pointer; }
.dyh-share-submit:disabled { opacity: .5; cursor: default; }
.dyh-share-more, .dyh-share-error button { border: 0; background: transparent; color: var(--brand-primary); padding: 8px; font: inherit; cursor: pointer; }
.dyh-share-error { color: var(--danger); }
</style>
