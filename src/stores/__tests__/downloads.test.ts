import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const mocks = vi.hoisted(() => ({
  startApkDownload: vi.fn(),
  pauseApkDownload: vi.fn().mockResolvedValue(undefined),
  cancelApkDownload: vi.fn().mockResolvedValue(undefined),
  deleteApkDownloadFile: vi.fn().mockResolvedValue(undefined),
  openApkDownloadDirectory: vi.fn().mockResolvedValue(undefined),
  installApkDownload: vi.fn().mockResolvedValue('started'),
}));

vi.mock('../../api/coolapk', () => ({ CoolapkTauriAPI: mocks }));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => undefined),
}));

import { useDownloadStore } from '../downloads';
import { useSettingsStore } from '../settings';

describe('下载管理队列', () => {
  it('删除安装包时同时传递公共副本地址，删除失败时保留记录', async () => {
    const store = useDownloadStore();
    const task = store.enqueue({ title: '示例', packageName: 'demo.delete', versionName: '1' });
    store.applyNativeEvent({ taskId: task.id, status: 'completed', path: '/download/demo.apk', publicPath: 'content://media/external/downloads/1' });
    mocks.deleteApkDownloadFile.mockRejectedValueOnce(new Error('无写入权限'));
    await store.remove(task.id, true);
    expect(store.tasks.some(item => item.id === task.id)).toBe(true);
    expect(mocks.deleteApkDownloadFile).toHaveBeenCalledWith(task.targetPath, task.partialPath, task.downloadDir, task.publicPath);
    await store.remove(task.id, true);
    expect(store.tasks.some(item => item.id === task.id)).toBe(false);
  });
  it('仅将已完成的 APK 交给安装器，跳过拆分安装包和未完成任务', async () => {
    const store = useDownloadStore();
    const task = { status: 'completed', targetPath: '/downloads/app.apk' } as any;
    await store.install(task);
    expect(mocks.installApkDownload).toHaveBeenCalledWith('/downloads/app.apk');
    mocks.installApkDownload.mockClear();
    await store.install({ ...task, status: 'downloading' });
    await store.install({ ...task, targetPath: '/downloads/app.xapk' });
    expect(mocks.installApkDownload).not.toHaveBeenCalled();
  });
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mocks.pauseApkDownload.mockResolvedValue(undefined);
    mocks.cancelApkDownload.mockResolvedValue(undefined);
    mocks.deleteApkDownloadFile.mockResolvedValue(undefined);
    mocks.openApkDownloadDirectory.mockResolvedValue(undefined);
  });

  it('按并发设置调度队列，并在任务完成后补充下一个任务', async () => {
    const pending: Array<(value: any) => void> = [];
    mocks.startApkDownload.mockImplementation(() => new Promise((resolve) => pending.push(resolve)));
    const settings = useSettingsStore();
    settings.settings.maxConcurrentDownloads = 2;
    const store = useDownloadStore();

    store.enqueue({ title: '应用一', packageName: 'com.demo.one', versionName: '1.0.0' });
    store.enqueue({ title: '应用二', packageName: 'com.demo.two', versionName: '1.0.0' });
    store.enqueue({ title: '应用三', packageName: 'com.demo.three', versionName: '1.0.0' });
    await Promise.resolve();
    await Promise.resolve();

    expect(mocks.startApkDownload).toHaveBeenCalledTimes(2);
    expect(store.tasks.filter((task) => task.status === 'queued')).toHaveLength(1);

    pending.shift()!({ status: 'completed', downloaded: 10, total: 10, path: 'C:\\Downloads\\one.apk' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.startApkDownload).toHaveBeenCalledTimes(3);
  });

  it('同一应用和版本不会重复加入队列，并保留官方风格的文件名字段', () => {
    const store = useDownloadStore();
    const first = store.enqueue({
      title: '示例应用',
      packageName: 'com.demo.app',
      versionName: '1.7.3',
      versionCode: 173,
      apkId: 42,
    });
    const second = store.enqueue({
      title: '示例应用',
      packageName: 'com.demo.app',
      versionName: '1.7.3',
      versionCode: 173,
      apkId: 42,
    });

    expect(second.id).toBe(first.id);
    expect(first.fileName).toBe('示例应用-1.7.3-173-42.apk');
    expect(store.tasks).toHaveLength(1);
  });

  it('暂停任务仍保留在当前任务，不会归入下载历史', async () => {
    let resolveDownload!: (value: any) => void;
    mocks.startApkDownload.mockImplementation(() => new Promise((resolve) => { resolveDownload = resolve; }));
    const store = useDownloadStore();
    const task = store.enqueue({ title: '暂停应用', packageName: 'com.demo.paused', versionName: '1.0.0' });
    await Promise.resolve();
    await Promise.resolve();

    await store.pause(task.id);

    expect(task.status).toBe('paused');
    expect(store.activeTasks).toHaveLength(1);
    expect(store.historyTasks).toHaveLength(0);

    resolveDownload({ status: 'paused', downloaded: 1, total: 2 });
    await Promise.resolve();
  });

  it('暂停事件会清零下载速度', () => {
    const store = useDownloadStore();
    const task = store.enqueue({ title: '速度应用', packageName: 'com.demo.speed', versionName: '1.0.0' });

    store.applyNativeEvent({ taskId: task.id, status: 'paused', downloaded: 16 * 1024 * 1024, total: 100 * 1024 * 1024, speed: 16 * 1024 * 1024 });

    expect(task.status).toBe('paused');
    expect(task.speed).toBe(0);
  });

  it('继续下载的起始事件不会清除已知总大小', () => {
    const store = useDownloadStore();
    const task = store.enqueue({ title: '续传应用', packageName: 'com.demo.resume', versionName: '1.0.0' });

    store.applyNativeEvent({ taskId: task.id, status: 'downloading', downloaded: 20, total: 100, speed: 5 });
    store.applyNativeEvent({ taskId: task.id, status: 'starting', downloaded: 20, total: 0, speed: 0 });

    expect(task.total).toBe(100);
    expect(task.downloaded).toBe(20);
  });

  it('计算当前所有下载中的合并总速度与已完成任务总体积', () => {
    const store = useDownloadStore();
    const task1 = store.enqueue({ title: '任务一', packageName: 'com.demo.t1', versionName: '1.0.0' });
    const task2 = store.enqueue({ title: '任务二', packageName: 'com.demo.t2', versionName: '1.0.0' });

    store.applyNativeEvent({ taskId: task1.id, status: 'downloading', downloaded: 50, total: 100, speed: 1024 });
    store.applyNativeEvent({ taskId: task2.id, status: 'downloading', downloaded: 30, total: 200, speed: 2048 });

    expect(store.totalSpeed).toBe(3072);

    store.applyNativeEvent({ taskId: task1.id, status: 'completed', downloaded: 100, total: 100, speed: 0 });
    expect(store.totalSpeed).toBe(2048);
    expect(store.completedTotalBytes).toBe(100);
  });

  it('支持全部暂停、全部继续与清空下载历史', async () => {
    const store = useDownloadStore();
    const task1 = store.enqueue({ title: '批量一', packageName: 'com.demo.b1', versionName: '1.0.0' });
    const task2 = store.enqueue({ title: '批量二', packageName: 'com.demo.b2', versionName: '1.0.0' });

    store.applyNativeEvent({ taskId: task1.id, status: 'downloading', downloaded: 10, total: 100, speed: 100 });
    store.applyNativeEvent({ taskId: task2.id, status: 'downloading', downloaded: 20, total: 200, speed: 200 });

    await store.pauseAll();
    expect(task1.status).toBe('paused');
    expect(task2.status).toBe('paused');

    await store.resumeAll();
    expect(['queued', 'downloading']).toContain(task1.status);
    expect(['queued', 'downloading']).toContain(task2.status);

    // 变为完成状态（进入历史）
    store.applyNativeEvent({ taskId: task1.id, status: 'completed', downloaded: 100, total: 100 });
    expect(store.historyTasks).toHaveLength(1);

    await store.clearHistory();
    expect(store.historyTasks).toHaveLength(0);
  });

  it('调用 openDirectory 打开指定或默认下载目录', async () => {
    const store = useDownloadStore();
    await store.openDirectory('D:\\CustomDownloads');
    expect(mocks.openApkDownloadDirectory).toHaveBeenCalledWith('D:\\CustomDownloads');
  });
});
