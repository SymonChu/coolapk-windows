<template>
  <article class="upload-task-card">
    <div class="upload-file-icon" aria-hidden="true">
      <i :class="fileIcon"></i>
    </div>

    <div class="upload-task-main">
      <div class="upload-title-row">
        <h3 class="upload-file-name" :title="task.fileName">{{ task.fileName }}</h3>
        <span :class="['upload-status', `status-${task.status}`]">
          <i :class="statusIcon"></i>
          {{ statusText }}
        </span>
      </div>

      <div class="upload-meta">
        <span>{{ task.total > 0 ? formatBytes(task.total) : task.status === 'queued' ? '等待上传' : '文件大小读取中' }}</span>
        <span v-if="task.createdAt">{{ formatDate(task.createdAt) }}</span>
      </div>

      <div v-if="isActive" class="upload-progress-section">
        <div class="upload-progress-track" :class="{ indeterminate: task.status === 'preparing' || !task.total }">
          <div class="upload-progress-fill" :style="{ width: `${progressPercent}%` }"></div>
        </div>
        <div class="upload-progress-meta">
          <span>{{ progressText }}</span>
          <span v-if="task.status === 'uploading' && task.speed > 0" class="upload-speed">
            <i class="fas fa-bolt"></i> {{ formatBytes(task.speed) }}/s
          </span>
          <span v-if="remainingText" class="upload-remaining">{{ remainingText }}</span>
        </div>
      </div>

      <div v-if="task.error" class="upload-error" :title="task.error">
        <i class="fas fa-circle-exclamation"></i>
        <span>{{ task.error }}</span>
      </div>

      <div v-if="task.url && task.status === 'completed'" class="upload-link" :title="task.url">
        <i class="fas fa-link"></i>
        <a :href="task.url" @click.prevent="openUrl">{{ task.url }}</a>
      </div>
    </div>

    <div class="upload-actions">
      <template v-if="task.status === 'completed' && task.url">
        <AppButton variant="secondary" size="sm" icon="fas fa-copy" @click="copyUrl">复制链接</AppButton>
        <AppButton variant="secondary" size="sm" icon="fas fa-arrow-up-right-from-square" @click="openUrl">打开</AppButton>
      </template>
      <AppButton
        v-else-if="task.status === 'failed' || task.status === 'cancelled'"
        variant="primary"
        size="sm"
        icon="fas fa-rotate-right"
        @click="emit('retry', task.id)"
      >
        重试
      </AppButton>
      <AppButton
        v-if="task.status === 'queued' || task.status === 'preparing' || task.status === 'uploading'"
        variant="ghost"
        size="sm"
        icon="fas fa-ban"
        @click="emit('cancel', task.id)"
      >
        取消上传
      </AppButton>
      <AppButton v-else-if="task.status === 'cancelling'" variant="ghost" size="sm" icon="fas fa-spinner fa-spin" disabled>
        取消中
      </AppButton>
      <AppButton
        v-if="task.status === 'failed' || task.status === 'cancelled' || task.status === 'completed'"
        variant="ghost"
        size="sm"
        icon="fas fa-trash-can"
        title="删除记录"
        @click="emit('remove', task.id)"
      >
        删除记录
      </AppButton>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AppButton from '../common/AppButton.vue';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { showToast } from '../../utils/toast';
import type { CdnUploadTask } from '../../types/upload';

const props = defineProps<{ task: CdnUploadTask }>();
const emit = defineEmits<{
  retry: [taskId: string];
  remove: [taskId: string];
  cancel: [taskId: string];
}>();

const isActive = computed(() => ['queued', 'preparing', 'uploading', 'cancelling'].includes(props.task.status));
const progressPercent = computed(() => {
  if (!props.task.total) return props.task.uploaded > 0 ? 5 : 0;
  return Math.min(100, Math.max(0, Math.round(props.task.uploaded / props.task.total * 100)));
});
const progressText = computed(() => {
  if (props.task.status === 'queued') return '等待队列';
  if (props.task.status === 'preparing') return '正在准备上传';
  if (props.task.status === 'cancelling') return '正在取消上传';
  const uploaded = formatBytes(props.task.uploaded);
  return props.task.total ? `${uploaded} / ${formatBytes(props.task.total)}（${progressPercent.value}%）` : `${uploaded} 已上传`;
});
const remainingText = computed(() => {
  if (props.task.status !== 'uploading' || props.task.total <= 0 || props.task.speed <= 0) return '';
  const remainingSeconds = Math.ceil(Math.max(props.task.total - props.task.uploaded, 0) / props.task.speed);
  if (remainingSeconds < 60) return `剩余约 ${remainingSeconds} 秒`;
  const remainingMinutes = Math.ceil(remainingSeconds / 60);
  if (remainingMinutes < 60) return `剩余约 ${remainingMinutes} 分钟`;
  if (remainingMinutes < 24 * 60) {
    const hours = Math.floor(remainingMinutes / 60);
    const minutes = remainingMinutes % 60;
    return minutes > 0 ? `剩余约 ${hours} 小时 ${minutes} 分钟` : `剩余约 ${hours} 小时`;
  }
  return `剩余约 ${Math.ceil(remainingMinutes / (24 * 60))} 天`;
});
const statusText = computed(() => ({
  queued: '排队中',
  preparing: '准备中',
  uploading: '上传中',
  cancelling: '取消中',
  completed: '已完成',
  failed: '上传失败',
  cancelled: '已取消',
}[props.task.status]));
const statusIcon = computed(() => ({
  queued: 'fas fa-clock',
  preparing: 'fas fa-spinner fa-spin',
  uploading: 'fas fa-cloud-arrow-up',
  cancelling: 'fas fa-spinner fa-spin',
  completed: 'fas fa-check',
  failed: 'fas fa-circle-exclamation',
  cancelled: 'fas fa-ban',
}[props.task.status]));
const fileIcon = computed(() => {
  const ext = props.task.fileName.split('.').pop()?.toLowerCase();
  if (ext === 'zip' || ext === '7z' || ext === 'rar') return 'fas fa-file-zipper';
  if (ext === 'pdf') return 'fas fa-file-pdf';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext || '')) return 'fas fa-file-image';
  if (['mp4', 'mov', 'mkv', 'avi', 'webm'].includes(ext || '')) return 'fas fa-file-video';
  if (['txt', 'log', 'md', 'csv', 'json', 'xml'].includes(ext || '')) return 'fas fa-file-lines';
  return 'fas fa-file';
});

function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'medium' }).format(timestamp);
}

async function copyUrl() {
  if (!props.task.url) return;
  try {
    await navigator.clipboard.writeText(props.task.url);
    showToast('链接已复制', 'success');
  } catch {
    showToast('复制失败，请手动选择链接复制', 'error');
  }
}

async function openUrl() {
  if (!props.task.url) return;
  try {
    await CoolapkTauriAPI.openUrl(props.task.url, 'system');
  } catch (error) {
    showToast(`打开链接失败：${String(error)}`, 'error');
  }
}
</script>

<style scoped>
.upload-task-card {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-card);
  background: var(--surface);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}

.upload-file-icon {
  display: flex;
  flex: 0 0 52px;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 14px;
  color: var(--brand-primary);
  background: var(--brand-soft);
  font-size: 23px;
}

.upload-task-main { min-width: 0; flex: 1; }
.upload-title-row { display: flex; align-items: center; gap: 10px; min-width: 0; }
.upload-file-name { min-width: 0; margin: 0; overflow: hidden; color: var(--text-primary); font-size: 15px; font-weight: var(--font-weight-semibold); text-overflow: ellipsis; white-space: nowrap; }
.upload-status { display: inline-flex; align-items: center; gap: 5px; flex: 0 0 auto; padding: 3px 8px; border-radius: var(--radius-pill); font-size: 11px; }
.status-queued { color: var(--info); background: rgba(47, 128, 237, 0.12); }
.status-preparing, .status-uploading { color: var(--brand-primary); background: var(--brand-soft); }
.status-cancelling { color: var(--warning); background: rgba(245, 159, 0, 0.12); }
.status-completed { color: var(--brand-primary); background: var(--brand-soft); }
.status-failed { color: var(--danger); background: rgba(240, 68, 68, 0.1); }
.status-cancelled { color: var(--text-tertiary); background: var(--surface-hover); }
.upload-meta { display: flex; gap: 12px; margin-top: 5px; color: var(--text-tertiary); font-size: 12px; }
.upload-progress-section { margin-top: 9px; }
.upload-progress-track { height: 7px; overflow: hidden; border-radius: var(--radius-pill); background: var(--background-secondary); }
.upload-progress-fill { height: 100%; border-radius: inherit; background: var(--brand-primary); transition: width 200ms ease; }
.upload-progress-track.indeterminate .upload-progress-fill { width: 34% !important; animation: upload-indeterminate 1.2s ease-in-out infinite alternate; }
@keyframes upload-indeterminate { from { transform: translateX(-20%); } to { transform: translateX(210%); } }
.upload-progress-meta { display: flex; justify-content: space-between; gap: 12px; margin-top: 5px; color: var(--text-tertiary); font-size: 12px; }
.upload-speed { color: var(--brand-primary); font-weight: var(--font-weight-medium); white-space: nowrap; }
.upload-remaining { color: var(--text-secondary); white-space: nowrap; }
.upload-error { display: flex; gap: 6px; margin-top: 7px; color: var(--danger); font-size: 12px; overflow-wrap: anywhere; }
.upload-link { display: flex; gap: 7px; margin-top: 7px; min-width: 0; color: var(--brand-primary); font-size: 12px; }
.upload-link a { min-width: 0; overflow: hidden; color: inherit; text-overflow: ellipsis; white-space: nowrap; }
.upload-actions { display: flex; align-items: center; justify-content: flex-end; gap: 6px; flex: 0 0 auto; }

@media (max-width: 900px) {
  .upload-task-card { flex-wrap: wrap; padding: 14px; }
  .upload-task-main { flex-basis: calc(100% - 68px); }
  .upload-actions { width: 100%; justify-content: flex-start; padding-left: 66px; }
}
</style>
