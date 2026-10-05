<template>
  <div class="page-container custom-scrollbar cdn-upload-page">
    <header class="cdn-upload-header">
      <div class="cdn-upload-title-group">
        <div class="cdn-upload-icon"><i class="fas fa-cloud-arrow-up"></i></div>
        <div>
          <h1>酷安 CDN 文件上传</h1>
          <p>选择本地文件，上传后获取酷安 CDN 链接</p>
        </div>
      </div>
      <AppButton variant="secondary" size="sm" icon="fas fa-list-check" @click="openUploadManager">
        上传和下载
      </AppButton>
    </header>

    <section ref="dropPanel" class="upload-picker-panel" :class="{ 'is-dragging': dragging }">
      <div class="picker-illustration"><i class="fas fa-file-arrow-up"></i></div>
      <h2>{{ dragging ? '松开即可上传文件' : '上传文件到酷安 CDN' }}</h2>
      <p class="picker-description">
        可一次选择多个文件，客户端会按顺序逐个上传。任务启动后将打开上传和下载管理页，实时显示进度、速度和返回链接。
      </p>
      <p v-if="supportsDrop" class="picker-description">也可以将文件拖到此处上传</p>
      <AppButton
        variant="primary"
        size="lg"
        icon="fas fa-folder-open"
        :loading="selectingFiles"
        @click="selectFiles"
      >
        选择文件并开始上传
      </AppButton>
      <p class="picker-hint">上传需要登录酷安账号。支持的格式和大小由酷安服务端决定，客户端不会修改文件内容。</p>
    </section>

    <section class="upload-notes">
      <article class="upload-note-card">
        <span class="note-icon"><i class="fas fa-user-check"></i></span>
        <div>
          <h3>使用当前登录账号</h3>
          <p>上传时使用客户端当前的酷安登录状态。未登录或登录失效时，任务会在管理页显示服务端错误。</p>
        </div>
      </article>
      <article class="upload-note-card">
        <span class="note-icon"><i class="fas fa-list-check"></i></span>
        <div>
          <h3>集中查看上传结果</h3>
          <p>上传队列、实时进度、历史记录和成功后的链接都保存在「上传和下载」页面。</p>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onActivated, onDeactivated, onMounted, onUnmounted, ref } from 'vue';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { isTouchMobilePlatform } from '../utils/platform';
import { useRouter } from 'vue-router';
import AppButton from '../components/common/AppButton.vue';
import { useUploadStore } from '../stores/uploads';
import { showToast } from '../utils/toast';

const router = useRouter();
const uploadStore = useUploadStore();
const selectingFiles = ref(false);
const supportsDrop = isTauri() && !isTouchMobilePlatform();
const dragging = ref(false);
const dropPanel = ref<HTMLElement | null>(null);
let active = true;
let disposed = false;
let stopDrop: UnlistenFn | undefined;
const uploadStoreReady = uploadStore.initialize();

onActivated(() => { active = true; });
onDeactivated(() => { active = false; dragging.value = false; });
onUnmounted(() => { disposed = true; active = false; stopDrop?.(); });
onMounted(() => {
  if (!supportsDrop) return;
  void getCurrentWebview().onDragDropEvent(event => {
    if (!active || disposed) return;
    const payload = event.payload;
    if (payload.type === 'leave') { dragging.value = false; return; }
    const bounds = dropPanel.value?.getBoundingClientRect();
    const x = payload.position.x / window.devicePixelRatio;
    const y = payload.position.y / window.devicePixelRatio;
    const inside = !!bounds && x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
    dragging.value = inside && payload.type !== 'drop';
    if (inside && payload.type === 'drop' && payload.paths.length) void uploadPaths(payload.paths);
  }).then(stop => { if (disposed) stop(); else stopDrop = stop; })
    .catch(() => { showToast('文件拖拽监听失败，请使用选择文件按钮', 'error'); });
});

async function uploadPaths(paths: string[]) {
  if (selectingFiles.value) return;
  selectingFiles.value = true;
  try {
    await uploadStoreReady;
    for (const path of new Set(paths)) uploadStore.enqueue(path);
    await uploadStore.pump();
    await router.push({ path: '/downloads', query: { mode: 'upload', tab: 'active' } });
  } catch (error) {
    showToast(`添加上传任务失败：${error instanceof Error ? error.message : String(error)}`, 'error');
  } finally {
    selectingFiles.value = false;
  }
}

async function selectFiles() {
  if (selectingFiles.value) return;
  selectingFiles.value = true;
  try {
    await uploadStoreReady;
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      multiple: true,
      directory: false,
      title: '选择要上传到酷安 CDN 的文件',
    });
    if (!selected) return;

    const paths = Array.isArray(selected) ? selected : [selected];
    selectingFiles.value = false;
    await uploadPaths(paths);
  } catch (error) {
    showToast(`选择或添加上传任务失败：${error instanceof Error ? error.message : String(error)}`, 'error');
  } finally {
    selectingFiles.value = false;
  }
}

function openUploadManager() {
  void router.push({ path: '/downloads', query: { mode: 'upload', tab: 'active' } });
}
</script>

<style scoped>
.cdn-upload-page {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  box-sizing: border-box;
  padding: var(--space-6) var(--space-8) var(--space-10);
}

.cdn-upload-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: var(--space-6);
}

.cdn-upload-title-group { display: flex; align-items: center; gap: 14px; min-width: 0; }
.cdn-upload-icon { display: grid; flex: 0 0 44px; width: 44px; height: 44px; place-items: center; border-radius: 14px; color: var(--brand-primary); background: var(--brand-soft); font-size: 20px; }
.cdn-upload-title-group h1 { margin: 0; color: var(--text-primary); font-size: var(--font-size-title-lg); font-weight: var(--font-weight-bold); }
.cdn-upload-title-group p { margin: 4px 0 0; color: var(--text-tertiary); font-size: 13px; }

.upload-picker-panel {
  display: flex;
  min-height: 330px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 36px 28px;
  border: 1px dashed var(--border);
  border-radius: 20px;
  background: var(--surface);
  text-align: center;
}

.picker-illustration { display: grid; width: 76px; height: 76px; place-items: center; border-radius: 24px; color: var(--brand-primary); background: var(--brand-soft); font-size: 34px; }
.upload-picker-panel.is-dragging { border-color: var(--brand-primary); background: var(--brand-soft); }
.upload-picker-panel h2 { margin: 20px 0 8px; color: var(--text-primary); font-size: 21px; }
.picker-description { max-width: 580px; margin: 0 0 22px; color: var(--text-secondary); font-size: 14px; line-height: 1.7; }
.picker-hint { max-width: 620px; margin: 16px 0 0; color: var(--text-tertiary); font-size: 12px; line-height: 1.6; }

.upload-notes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); margin-top: var(--space-4); }
.upload-note-card { display: flex; align-items: flex-start; gap: 12px; min-width: 0; padding: 16px; border: 1px solid var(--border-light); border-radius: var(--radius-card); background: var(--surface); }
.note-icon { display: grid; flex: 0 0 34px; width: 34px; height: 34px; place-items: center; border-radius: 10px; color: var(--brand-primary); background: var(--brand-soft); }
.upload-note-card h3 { margin: 1px 0 5px; color: var(--text-primary); font-size: 14px; }
.upload-note-card p { margin: 0; color: var(--text-secondary); font-size: 12px; line-height: 1.6; }

@media (max-width: 900px) {
  .cdn-upload-page { padding: var(--space-4); }
  .cdn-upload-header { align-items: flex-start; }
  .cdn-upload-header :deep(.app-button) { flex: 0 0 auto; }
  .upload-picker-panel { min-height: 290px; padding: 28px 18px; }
  .upload-notes { grid-template-columns: 1fr; }
}

@media (max-width: 520px) {
  .cdn-upload-header { flex-direction: column; }
  .cdn-upload-title-group h1 { font-size: 20px; }
  .picker-description { font-size: 13px; }
}
</style>
