import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { CoolapkTauriAPI } from '../api/coolapk';
import { showToast } from '../utils/toast';
import { useSettingsStore } from './settings';
import type { DownloadStatus, DownloadTask } from '../types/download';

const STORAGE_KEY = 'coolapk_desktop_downloads_v1';
const ACTIVE_STATUSES: DownloadStatus[] = ['queued', 'downloading', 'paused'];

type NativeDownloadEvent = {
  taskId?: string;
  status?: string;
  downloaded?: number;
  total?: number;
  speed?: number;
  path?: string;
  partialPath?: string;
  publicPath?: string;
  error?: string;
};

function now() {
  return Date.now();
}

function createTaskId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `download-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readTasks(): DownloadTask[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
      return parsed.filter((item): item is DownloadTask => item && typeof item.id === 'string' && typeof item.packageName === 'string')
      .map((item) => ({
        ...item,
        downloadDir: typeof item.downloadDir === 'string' ? item.downloadDir : '',
        targetPath: typeof item.targetPath === 'string' ? item.targetPath : '',
        partialPath: typeof item.partialPath === 'string' ? item.partialPath : '',
        publicPath: typeof item.publicPath === 'string' ? item.publicPath : '',
        status: ACTIVE_STATUSES.includes(item.status) ? 'paused' : item.status,
        downloaded: Number(item.downloaded) || 0,
        total: Number(item.total) || 0,
        speed: 0,
        retryCount: Number(item.retryCount) || 0,
        error: typeof item.error === 'string' ? item.error : '',
      }));
  } catch {
    return [];
  }
}

function writeTasks(tasks: DownloadTask[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (error) {
    console.warn('保存下载历史失败:', error);
  }
}

function normalizeStatus(value: string | undefined): DownloadStatus | null {
  if (value === 'starting' || value === 'downloading') return 'downloading';
  if (value === 'paused') return 'paused';
  if (value === 'completed') return 'completed';
  if (value === 'canceled') return 'canceled';
  if (value === 'failed') return 'failed';
  return null;
}

function extensionFor(options: { fileName?: string; kind?: string }) {
  const source = options.fileName || '';
  const matched = source.match(/\.(apk|xapk|apks)$/i);
  if (matched) return matched[1].toLowerCase();
  return options.kind === 'xapk' || options.kind === 'apks' ? options.kind : 'apk';
}

function buildFileName(options: {
  title: string;
  packageName: string;
  versionName?: string;
  versionCode?: string | number;
  apkId?: string | number;
  fileName?: string;
  kind?: string;
}) {
  if (options.fileName?.trim()) return options.fileName.trim();
  const title = options.title.trim() || options.packageName;
  const version = options.versionName?.trim() || '未知版本';
  const versionCode = String(options.versionCode ?? '').trim() || '0';
  const apkId = String(options.apkId ?? '').trim() || 'unknown';
  return `${title}-${version}-${versionCode}-${apkId}.${extensionFor(options)}`;
}

export const useDownloadStore = defineStore('downloads', () => {
  const tasks = ref<DownloadTask[]>(readTasks());
  const runningIds = new Set<string>();
  let initialized = false;
  let eventUnlisten: UnlistenFn | null = null;
  let saveErrorUnlisten: UnlistenFn | null = null;
  let pumpQueued = false;

  const activeTasks = computed(() => tasks.value.filter((task) => ACTIVE_STATUSES.includes(task.status)));
  const historyTasks = computed(() => tasks.value.filter((task) => !ACTIVE_STATUSES.includes(task.status)));
  const activeCount = computed(() => activeTasks.value.length);
  const totalSpeed = computed(() => {
    return activeTasks.value.reduce((acc, task) => {
      return task.status === 'downloading' && task.speed > 0 ? acc + task.speed : acc;
    }, 0);
  });
  const completedTotalBytes = computed(() => {
    return tasks.value.reduce((acc, task) => {
      return task.status === 'completed' ? acc + (task.total || task.downloaded || 0) : acc;
    }, 0);
  });

  function persist() {
    writeTasks(tasks.value);
  }

  function findTask(taskId: string) {
    return tasks.value.find((task) => task.id === taskId);
  }

  function patchTask(taskId: string, patch: Partial<DownloadTask>) {
    const task = findTask(taskId);
    if (!task) return;
    Object.assign(task, patch, { updatedAt: now() });
    persist();
  }

  function applyNativeEvent(event: NativeDownloadEvent) {
    if (!event.taskId) return;
    const task = findTask(event.taskId);
    if (!task) return;
    const status = normalizeStatus(event.status);
    const patch: Partial<DownloadTask> = {};
    if (status) patch.status = status;
    if (typeof event.downloaded === 'number' && Number.isFinite(event.downloaded)) patch.downloaded = Math.max(0, event.downloaded);
    if (typeof event.total === 'number' && Number.isFinite(event.total) && event.total > 0) patch.total = event.total;
    if (typeof event.speed === 'number' && Number.isFinite(event.speed)) patch.speed = Math.max(0, event.speed);
    if (status === 'paused') patch.speed = 0;
    if (event.path) patch.targetPath = event.path;
    if (event.partialPath) patch.partialPath = event.partialPath;
    if (event.publicPath) patch.publicPath = event.publicPath;
    if (event.error) patch.error = event.error;
    if (status === 'completed') {
      patch.completedAt = now();
      patch.error = '';
    }
    if (status === 'failed') patch.error = event.error || task.error || '下载失败';
    patchTask(event.taskId, patch);
    if (status === 'completed' || status === 'failed' || status === 'paused' || status === 'canceled') void pump();
  }

  async function initialize() {
    if (initialized) return;
    initialized = true;
    if (/android/i.test(navigator.userAgent)) {
      saveErrorUnlisten = await listen<string>('android-file-save-error', (event) => {
        showToast(`安装包已下载到应用目录，保存到公共目录失败：${event.payload}`, 'error', 6000);
      });
    }
    // 应用重启后原生下载通道已经不存在，恢复成暂停状态，保留 .part 文件供继续下载。
    for (const task of tasks.value) {
      if (ACTIVE_STATUSES.includes(task.status)) task.status = 'paused';
    }
    persist();
    try {
      eventUnlisten = await listen<NativeDownloadEvent>('apk-download-progress', (event) => applyNativeEvent(event.payload));
    } catch (error) {
      console.warn('监听下载进度失败:', error);
    }
  }

  async function pump() {
    if (pumpQueued) return;
    pumpQueued = true;
    await Promise.resolve();
    pumpQueued = false;
    const settingsStore = useSettingsStore();
    const limit = [1, 2, 3, 4, 5, 6, 8].includes(settingsStore.settings.maxConcurrentDownloads)
      ? settingsStore.settings.maxConcurrentDownloads
      : 3;
    while (runningIds.size < limit) {
      const task = tasks.value.find((item) => item.status === 'queued' && !runningIds.has(item.id));
      if (!task) break;
      runningIds.add(task.id);
      patchTask(task.id, { status: 'downloading', error: '' });
      void runTask(task).finally(() => {
        runningIds.delete(task.id);
        void pump();
      });
    }
  }

  async function runTask(task: DownloadTask) {
    const settingsStore = useSettingsStore();
    try {
      const result = await CoolapkTauriAPI.startApkDownload({
        taskId: task.id,
        packageName: task.packageName,
        apkName: task.packageName,
        apkId: task.apkId,
        versionCode: task.versionCode,
        fileName: task.fileName,
        dir: task.downloadDir,
        // 系统默认目录不保存操作系统专属的绝对路径，允许换平台后按文件名重新定位断点文件。
        targetPath: task.downloadDir ? task.targetPath : '',
        extraAnalysisData: task.extraAnalysisData,
        proxyUrl: settingsStore.settings.proxyUrl,
      });
      const status = normalizeStatus(result?.status) || 'completed';
      patchTask(task.id, {
        status,
        downloaded: Number(result?.downloaded) || task.downloaded,
        total: Number(result?.total) || task.total,
        targetPath: result?.path || task.targetPath,
        partialPath: result?.partialPath || task.partialPath,
        publicPath: result?.publicPath || task.publicPath,
        completedAt: status === 'completed' ? now() : task.completedAt,
        error: '',
      });
    } catch (error) {
      patchTask(task.id, {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        retryCount: task.retryCount + 1,
        speed: 0,
      });
    }
  }

  function enqueue(options: {
    title: string;
    packageName: string;
    versionName?: string;
    versionCode?: string | number;
    apkId?: string | number;
    logoUrl?: string;
    fileName?: string;
    kind?: 'apk' | 'xapk' | 'apks';
    extraAnalysisData?: string;
    total?: number;
  }): DownloadTask {
    const versionName = options.versionName?.trim() || '';
    const existing = tasks.value.find((task) => task.packageName === options.packageName && task.versionName === versionName && task.status !== 'canceled');
    if (existing) return existing;
    const createdAt = now();
    const kind = options.kind || 'apk';
    const task: DownloadTask = {
      id: createTaskId(),
      kind,
      title: options.title.trim() || options.packageName,
      packageName: options.packageName,
      versionName,
      versionCode: String(options.versionCode ?? ''),
      apkId: String(options.apkId ?? ''),
      logoUrl: options.logoUrl || '',
      fileName: buildFileName({ ...options, kind }),
      extraAnalysisData: options.extraAnalysisData || '',
      downloadDir: useSettingsStore().settings.downloadPath,
      targetPath: '',
      partialPath: '',
      status: 'queued',
      downloaded: 0,
      total: typeof options.total === 'number' && options.total > 0 ? options.total : 0,
      speed: 0,
      retryCount: 0,
      error: '',
      createdAt,
      updatedAt: createdAt,
      completedAt: 0,
    };
    tasks.value.unshift(task);
    persist();
    void pump();
    return task;
  }

  async function pause(taskId: string) {
    const task = findTask(taskId);
    if (!task) return;
    if (task.status === 'queued') {
      patchTask(taskId, { status: 'paused' });
      return;
    }
    if (task.status !== 'downloading') return;
    patchTask(taskId, { status: 'paused', speed: 0 });
    try {
      await CoolapkTauriAPI.pauseApkDownload(taskId);
    } catch (error) {
      patchTask(taskId, { status: 'downloading', error: error instanceof Error ? error.message : String(error) });
    }
  }

  async function resume(taskId: string) {
    const task = findTask(taskId);
    if (!task || !['paused', 'failed', 'canceled'].includes(task.status)) return;
    patchTask(taskId, { status: 'queued', error: '', speed: 0 });
    await pump();
  }

  async function cancel(taskId: string) {
    const task = findTask(taskId);
    if (!task) return;
    if (task.status === 'queued' || task.status === 'paused' || task.status === 'failed') {
      patchTask(taskId, { status: 'canceled', speed: 0 });
      return;
    }
    if (task.status !== 'downloading') return;
    patchTask(taskId, { status: 'canceled', speed: 0 });
    try {
      await CoolapkTauriAPI.cancelApkDownload(taskId);
    } catch (error) {
      patchTask(taskId, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  async function retry(taskId: string) {
    await resume(taskId);
  }

  async function remove(taskId: string, deleteFile = false) {
    const task = findTask(taskId);
    if (!task) return;
    if (task.status === 'downloading') await cancel(taskId);
    if (deleteFile) {
      try {
        await CoolapkTauriAPI.deleteApkDownloadFile(task.targetPath, task.partialPath, task.downloadDir, task.publicPath);
      } catch (error) {
        // 跨平台迁移后旧绝对路径可能已经不属于当前系统，删除记录不能被这个历史路径阻塞。
        if (task.publicPath) {
          showToast(`删除安装包失败，已保留下载记录：${String(error)}`, 'error');
          return;
        }
        console.warn('删除下载文件失败，将继续删除任务记录:', error);
      }
    }
    tasks.value = tasks.value.filter((item) => item.id !== taskId);
    persist();
  }

  async function open(task: DownloadTask) {
    await CoolapkTauriAPI.openApkDownloadDirectory(task.downloadDir);
  }

  async function install(task: DownloadTask) {
    if (task.status !== 'completed' || !task.targetPath || !/\.apk$/i.test(task.targetPath)) return;
    try {
      const result = await CoolapkTauriAPI.installApkDownload(task.targetPath);
      if (result === 'permission_required') showToast('请允许安装未知应用，返回后再次点击安装', 'info', 6000);
    } catch (error) {
      showToast(`启动安装失败：${String(error)}`, 'error');
    }
  }

  async function openDirectory(dir?: string) {
    const target = dir || useSettingsStore().settings.downloadPath || '';
    await CoolapkTauriAPI.openApkDownloadDirectory(target);
  }

  async function pauseAll() {
    const active = activeTasks.value.filter((task) => task.status === 'downloading' || task.status === 'queued');
    for (const task of active) {
      await pause(task.id);
    }
  }

  async function resumeAll() {
    const paused = activeTasks.value.filter((task) => task.status === 'paused');
    for (const task of paused) {
      patchTask(task.id, { status: 'queued', error: '', speed: 0 });
    }
    await pump();
  }

  async function clearHistory(deleteFiles = false) {
    const targets = [...historyTasks.value];
    for (const task of targets) {
      await remove(task.id, deleteFiles);
    }
  }

  watch(
    () => useSettingsStore().settings.maxConcurrentDownloads,
    () => void pump(),
  );

  return {
    tasks,
    activeTasks,
    historyTasks,
    activeCount,
    totalSpeed,
    completedTotalBytes,
    initialize,
    enqueue,
    pump,
    pause,
    resume,
    cancel,
    retry,
    remove,
    open,
    openDirectory,
    install,
    pauseAll,
    resumeAll,
    clearHistory,
    applyNativeEvent,
    get eventUnlisten() { return eventUnlisten; },
  };
});
