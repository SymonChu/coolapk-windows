import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { CoolapkTauriAPI } from '../api/coolapk';
import type { CdnUploadProgressEvent, CdnUploadStatus, CdnUploadTask } from '../types/upload';
import { normalizeCdnUploadUrl } from '../utils/cdnUploadUrl';

const STORAGE_KEY = 'coolapk_desktop_cdn_uploads_v1';
const ACTIVE_STATUSES: CdnUploadStatus[] = ['queued', 'preparing', 'uploading', 'cancelling'];
const TERMINAL_STATUSES = new Set<CdnUploadStatus>(['completed', 'failed', 'cancelled']);
const INTERRUPTED_ERROR = '应用重启后上传任务已中断，请重新上传';

function now() {
  return Date.now();
}

function createTaskId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `cdn-upload-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readTasks(): CdnUploadTask[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is CdnUploadTask => item && typeof item.id === 'string' && typeof item.filePath === 'string')
      .map((item) => ({
        id: item.id,
        attempt: Math.max(1, Number(item.attempt) || 1),
        filePath: item.filePath,
        fileName: typeof item.fileName === 'string' ? item.fileName : item.filePath.split(/[\\/]/).pop() || '未知文件',
        status: ['queued', 'preparing', 'uploading', 'cancelling', 'completed', 'failed', 'cancelled'].includes(item.status) ? item.status : 'failed',
        uploaded: Math.max(0, Number(item.uploaded) || 0),
        total: Math.max(0, Number(item.total) || 0),
        speed: 0,
        url: typeof item.url === 'string' ? normalizeCdnUploadUrl(item.url) : '',
        error: typeof item.error === 'string' ? item.error : '',
        createdAt: Number(item.createdAt) || now(),
        updatedAt: Number(item.updatedAt) || now(),
        completedAt: Number(item.completedAt) || 0,
      }));
  } catch {
    return [];
  }
}

function writeTasks(tasks: CdnUploadTask[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (error) {
    console.warn('保存 CDN 上传记录失败:', error);
  }
}

function normalizeStatus(status: string | undefined): CdnUploadStatus | null {
  if (status === 'queued' || status === 'preparing' || status === 'uploading' || status === 'cancelling' || status === 'completed' || status === 'failed' || status === 'cancelled') {
    return status;
  }
  return null;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return String(error || '上传失败');
}

export const useUploadStore = defineStore('cdn-uploads', () => {
  const tasks = ref<CdnUploadTask[]>(readTasks());
  const runningIds = new Set<string>();
  let initialized = false;
  let eventUnlisten: UnlistenFn | null = null;
  let pumpQueued = false;

  const activeTasks = computed(() => tasks.value.filter((task) => ACTIVE_STATUSES.includes(task.status)));
  const historyTasks = computed(() => tasks.value.filter((task) => !ACTIVE_STATUSES.includes(task.status)));
  const activeCount = computed(() => activeTasks.value.length);
  const totalSpeed = computed(() => activeTasks.value.reduce((sum, task) => sum + (task.status === 'uploading' ? task.speed : 0), 0));
  const completedCount = computed(() => tasks.value.filter((task) => task.status === 'completed').length);

  function persist() {
    writeTasks(tasks.value);
  }

  function findTask(taskId: string) {
    return tasks.value.find((task) => task.id === taskId);
  }

  function patchTask(taskId: string, patch: Partial<CdnUploadTask>) {
    const task = findTask(taskId);
    if (!task) return;
    if (typeof patch.url === 'string') patch.url = normalizeCdnUploadUrl(patch.url);
    Object.assign(task, patch, { updatedAt: now() });
    persist();
  }

  function applyNativeEvent(event: CdnUploadProgressEvent) {
    if (!event.taskId) return;
    const task = findTask(event.taskId);
    if (!task || event.attempt !== task.attempt) return;

    const status = normalizeStatus(event.status);
    if (TERMINAL_STATUSES.has(task.status) && status !== task.status) return;
    const patch: Partial<CdnUploadTask> = {};
    if (status && !(task.status === 'cancelling' && ['queued', 'preparing', 'uploading'].includes(status))) {
      patch.status = status;
    }
    if (event.fileName) patch.fileName = event.fileName;
    const uploaded = typeof event.uploaded === 'number' ? event.uploaded : event.downloaded;
    if (typeof uploaded === 'number' && Number.isFinite(uploaded)) patch.uploaded = Math.max(task.uploaded, uploaded, 0);
    if (typeof event.total === 'number' && Number.isFinite(event.total)) patch.total = Math.max(0, event.total);
    if (typeof event.speed === 'number' && Number.isFinite(event.speed)) patch.speed = task.status === 'cancelling' ? 0 : Math.max(0, event.speed);
    if (event.url) patch.url = event.url;
    if (event.error) patch.error = event.error;
    if (status === 'preparing' || status === 'queued' || status === 'cancelling' || status === 'completed' || status === 'failed' || status === 'cancelled') patch.speed = 0;
    if (status === 'completed') {
      patch.completedAt = now();
      patch.error = '';
      if (typeof event.total === 'number' && event.total > 0) patch.uploaded = event.total;
    }
    if (status === 'failed') patch.error = event.error || task.error || '上传失败';
    if (status === 'cancelled') {
      patch.error = '';
      patch.url = '';
    }
    patchTask(event.taskId, patch);
  }

  async function initialize() {
    if (initialized) return;
    initialized = true;
    // 上传没有可恢复的断点；关闭应用后让历史记录明确显示中断，不自动重复发送文件。
    let changed = false;
    for (const task of tasks.value) {
      if (ACTIVE_STATUSES.includes(task.status)) {
        task.status = 'failed';
        task.speed = 0;
        task.error = INTERRUPTED_ERROR;
        task.updatedAt = now();
        changed = true;
      }
    }
    if (changed) persist();
    try {
      eventUnlisten = await listen<CdnUploadProgressEvent>('cdn-upload-progress', (event) => applyNativeEvent(event.payload));
    } catch (error) {
      console.warn('监听 CDN 上传进度失败:', error);
    }
  }

  function enqueue(filePath: string, fileName?: string) {
    const normalizedPath = filePath.trim();
    if (!normalizedPath) return null;
    const task: CdnUploadTask = {
      id: createTaskId(),
      attempt: 1,
      filePath: normalizedPath,
      fileName: fileName?.trim() || normalizedPath.split(/[\\/]/).pop() || '未知文件',
      status: 'queued',
      uploaded: 0,
      total: 0,
      speed: 0,
      url: '',
      error: '',
      createdAt: now(),
      updatedAt: now(),
      completedAt: 0,
    };
    tasks.value.unshift(task);
    persist();
    if (initialized) void pump();
    return task;
  }

  async function runTask(task: CdnUploadTask) {
    patchTask(task.id, { status: 'preparing', error: '', speed: 0, uploaded: 0, url: '' });
    try {
      const result = await CoolapkTauriAPI.uploadFileToCdn(task.id, task.filePath, task.attempt) as
        | string
        | { code?: number; data?: string; url?: string; status?: string; error?: string; message?: string }
        | null
        | undefined;
      const current = findTask(task.id);
      if (!current || TERMINAL_STATUSES.has(current.status)) return;
      const url = typeof result === 'string' ? result : result?.url || result?.data || '';
      const returnedStatus = normalizeStatus(typeof result === 'object' ? result?.status : undefined);
      if (returnedStatus === 'cancelled' || (typeof result === 'object' && result?.code === 499)) {
        patchTask(task.id, { status: 'cancelled', speed: 0, url: '', error: '' });
        return;
      }
      if (returnedStatus === 'failed') {
        patchTask(task.id, { status: 'failed', speed: 0, error: typeof result === 'object' ? result?.error || result?.message || '上传失败' : '上传失败' });
        return;
      }
      if (typeof result === 'object' && typeof result?.code === 'number' && result.code !== 200) {
        patchTask(task.id, { status: 'failed', speed: 0, error: result.error || result.message || `上传失败（服务端返回 ${result.code}）` });
        return;
      }
      patchTask(task.id, {
        status: 'completed',
        speed: 0,
        uploaded: current.total || current.uploaded,
        url: url || current.url,
        error: '',
        completedAt: now(),
      });
    } catch (error) {
      const current = findTask(task.id);
      if (current && !TERMINAL_STATUSES.has(current.status)) {
        patchTask(task.id, { status: 'failed', speed: 0, error: errorMessage(error) });
      }
    }
  }

  async function pump() {
    if (!initialized || pumpQueued || runningIds.size > 0) return;
    pumpQueued = true;
    await Promise.resolve();
    pumpQueued = false;
    // 列表按最新优先展示，但任务要严格按用户选择顺序串行执行。
    const task = [...tasks.value].reverse().find((item) => item.status === 'queued' && !runningIds.has(item.id));
    if (!task) return;
    runningIds.add(task.id);
    void runTask(task).finally(() => {
      runningIds.delete(task.id);
      void pump();
    });
  }

  function retry(taskId: string) {
    const task = findTask(taskId);
    if (!task || (task.status !== 'failed' && task.status !== 'cancelled')) return;
    // 新轮次先换 attempt，先于 pump 生效，阻止旧请求的迟到事件短暂改写排队任务。
    patchTask(taskId, { status: 'queued', attempt: task.attempt + 1, uploaded: 0, speed: 0, url: '', error: '', completedAt: 0 });
    if (initialized) void pump();
  }

  async function cancel(taskId: string) {
    const task = findTask(taskId);
    if (!task) return;
    if (task.status === 'queued') {
      patchTask(taskId, { status: 'cancelled', speed: 0, error: '', url: '' });
      return;
    }
    if (task.status !== 'preparing' && task.status !== 'uploading') return;

    const previousStatus = task.status;
    const previousError = task.error;
    patchTask(taskId, { status: 'cancelling', speed: 0, error: '' });
    try {
      const accepted = await CoolapkTauriAPI.cancelCdnUpload(taskId);
      const current = findTask(taskId);
      if (accepted === false && current?.status === 'cancelling') {
        patchTask(taskId, { status: previousStatus, error: '取消未生效，上传任务可能已结束' });
      }
    } catch (error) {
      const current = findTask(taskId);
      if (current?.status === 'cancelling') {
        patchTask(taskId, { status: previousStatus, error: `取消上传失败：${errorMessage(error) || previousError}` });
      }
    }
  }

  function remove(taskId: string) {
    const task = findTask(taskId);
    if (!task || ACTIVE_STATUSES.includes(task.status)) return;
    tasks.value = tasks.value.filter((task) => task.id !== taskId);
    persist();
  }

  function clearHistory() {
    tasks.value = tasks.value.filter((task) => ACTIVE_STATUSES.includes(task.status));
    persist();
  }

  return {
    tasks,
    activeTasks,
    historyTasks,
    activeCount,
    totalSpeed,
    completedCount,
    initialize,
    enqueue,
    pump,
    retry,
    cancel,
    remove,
    clearHistory,
    applyNativeEvent,
    get eventUnlisten() { return eventUnlisten; },
  };
});
