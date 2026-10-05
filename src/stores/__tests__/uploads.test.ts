import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const mocks = vi.hoisted(() => ({
  uploadFileToCdn: vi.fn(),
  cancelCdnUpload: vi.fn(),
}));

vi.mock('../../api/coolapk', () => ({ CoolapkTauriAPI: mocks }));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => undefined),
}));

import { useUploadStore } from '../uploads';

describe('酷安 CDN 上传队列', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('旧记录、原生进度和上传返回的 HTTP 链接统一升级到 HTTPS', async () => {
    localStorage.setItem('coolapk_desktop_cdn_uploads_v1', JSON.stringify([{ id: 'old', filePath: 'C:\\old.zip', status: 'completed', url: 'http://image.coolapk.com/old.zip' }]));
    const store = useUploadStore();
    expect(store.tasks[0]?.url).toBe('https://image.coolapk.com/old.zip');
    let finish!: (result: { code: number; data: string }) => void;
    mocks.uploadFileToCdn.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await store.initialize();
    const task = store.enqueue('C:\\new.zip')!;
    await vi.waitFor(() => expect(mocks.uploadFileToCdn).toHaveBeenCalledOnce());
    store.applyNativeEvent({ taskId: task.id, attempt: task.attempt, status: 'uploading', url: 'http://image.coolapk.com/progress.zip' });
    expect(task.url).toBe('https://image.coolapk.com/progress.zip');
    finish({ code: 200, data: 'http://image.coolapk.com/new.zip' });
    await vi.waitFor(() => expect(task.status).toBe('completed'));
    expect(task.url).toBe('https://image.coolapk.com/new.zip');
  });

  it('串行上传并记录服务端返回的链接和进度事件', async () => {
    const pending: Array<(result: { code: number; data: string }) => void> = [];
    mocks.uploadFileToCdn.mockImplementation(() => new Promise((resolve) => pending.push(resolve)));
    const store = useUploadStore();
    await store.initialize();

    const first = store.enqueue('C:\\upload\\first.zip')!;
    const second = store.enqueue('C:\\upload\\second.txt')!;
    await store.pump();
    await vi.waitFor(() => expect(mocks.uploadFileToCdn).toHaveBeenCalledTimes(1));
    expect(mocks.uploadFileToCdn).toHaveBeenCalledWith(first.id, first.filePath, first.attempt);
    expect(second.status).toBe('queued');

    store.applyNativeEvent({ taskId: first.id, attempt: first.attempt, status: 'uploading', uploaded: 25, total: 100, speed: 12 });
    expect(first.uploaded).toBe(25);
    expect(first.speed).toBe(12);

    pending.shift()!({ code: 200, data: 'https://image.coolapk.com/file/first.zip' });
    await vi.waitFor(() => expect(mocks.uploadFileToCdn).toHaveBeenCalledTimes(2));
    expect(first.status).toBe('completed');
    expect(first.url).toBe('https://image.coolapk.com/file/first.zip');
    expect(first.uploaded).toBe(100);

    pending.shift()!({ code: 200, data: 'https://image.coolapk.com/file/second.txt' });
    await vi.waitFor(() => expect(second.status).toBe('completed'));
    expect(store.historyTasks.map((task) => task.id)).toEqual([second.id, first.id]);
  });

  it('兼容旧进度字段并将重启前未完成的任务标记失败', async () => {
    localStorage.setItem('coolapk_desktop_cdn_uploads_v1', JSON.stringify([{
      id: 'interrupted',
      filePath: 'C:\\upload\\pending.pdf',
      fileName: 'pending.pdf',
      status: 'uploading',
      uploaded: 40,
      total: 100,
    }]));
    const store = useUploadStore();
    await store.initialize();

    const task = store.tasks[0]!;
    expect(task.status).toBe('failed');
    expect(task.error).toContain('应用重启后');
    store.applyNativeEvent({ taskId: task.id, attempt: task.attempt, status: 'uploading', downloaded: 55, total: 100, speed: 8 });
    expect(task.uploaded).toBe(40);
  });

  it('删除记录不会清除仍在运行的任务', async () => {
    mocks.uploadFileToCdn.mockImplementation(() => new Promise(() => undefined));
    const store = useUploadStore();
    await store.initialize();
    const task = store.enqueue('C:\\upload\\active.bin')!;
    await store.pump();
    await vi.waitFor(() => expect(task.status).toBe('preparing'));

    store.remove(task.id);
    expect(store.tasks.some((item) => item.id === task.id)).toBe(true);
  });

  it('排队任务在本地取消，不调用后端取消命令', async () => {
    const store = useUploadStore();
    const task = store.enqueue('C:\\upload\\queued.txt')!;

    await store.cancel(task.id);

    expect(task.status).toBe('cancelled');
    expect(store.activeTasks).toHaveLength(0);
    expect(store.historyTasks.some((item) => item.id === task.id)).toBe(true);
    expect(mocks.cancelCdnUpload).not.toHaveBeenCalled();
    expect(mocks.uploadFileToCdn).not.toHaveBeenCalled();
  });

  it('运行任务取消后保持取消中，收到取消事件后进入历史且不被上传结果覆盖', async () => {
    let resolveUpload!: (result: { code: number; data?: string }) => void;
    mocks.uploadFileToCdn.mockImplementation(() => new Promise((resolve) => { resolveUpload = resolve; }));
    mocks.cancelCdnUpload.mockResolvedValue(true);
    const store = useUploadStore();
    await store.initialize();
    const task = store.enqueue('C:\\upload\\running.zip')!;
    await vi.waitFor(() => expect(mocks.uploadFileToCdn).toHaveBeenCalledTimes(1));

    await store.cancel(task.id);
    expect(mocks.cancelCdnUpload).toHaveBeenCalledWith(task.id);
    expect(task.status).toBe('cancelling');
    expect(store.activeTasks.some((item) => item.id === task.id)).toBe(true);

    store.applyNativeEvent({ taskId: task.id, attempt: task.attempt, status: 'cancelled' });
    expect(task.status).toBe('cancelled');
    expect(store.historyTasks.some((item) => item.id === task.id)).toBe(true);

    resolveUpload({ code: 200, data: 'https://image.coolapk.com/should-not-win.zip' });
    await vi.waitFor(() => expect(task.status).toBe('cancelled'));
    expect(task.url).toBe('');
  });

  it('将后端 499 cancelled 响应记为已取消，并允许重新上传', async () => {
    mocks.uploadFileToCdn
      .mockResolvedValueOnce({ code: 499, status: 'cancelled' })
      .mockResolvedValueOnce({ code: 200, data: 'https://image.coolapk.com/retry.zip' });
    const store = useUploadStore();
    await store.initialize();
    const task = store.enqueue('C:\\upload\\retry.zip')!;
    await vi.waitFor(() => expect(task.status).toBe('cancelled'));

    expect(task.status).not.toBe('failed');
    expect(task.status).not.toBe('completed');
    store.retry(task.id);
    const retriedAttempt = task.attempt;
    store.applyNativeEvent({ taskId: task.id, attempt: retriedAttempt - 1, status: 'uploading', uploaded: 99, total: 100 });
    expect(task.status).toBe('queued');
    expect(task.uploaded).toBe(0);
    await vi.waitFor(() => expect(task.status).toBe('completed'));
    expect(task.url).toBe('https://image.coolapk.com/retry.zip');
    expect(mocks.uploadFileToCdn).toHaveBeenCalledTimes(2);
    expect(mocks.uploadFileToCdn).toHaveBeenLastCalledWith(task.id, task.filePath, retriedAttempt);
  });

  it('丢弃旧 attempt 事件并阻止同轮进度回退', () => {
    const store = useUploadStore();
    const task = store.enqueue('C:\\upload\\monotonic.bin')!;

    store.applyNativeEvent({ taskId: task.id, attempt: task.attempt, status: 'uploading', uploaded: 60, total: 100, speed: 15 });
    store.applyNativeEvent({ taskId: task.id, attempt: task.attempt, status: 'uploading', uploaded: 20, total: 100, speed: 5 });
    expect(task.uploaded).toBe(60);

    store.applyNativeEvent({ taskId: task.id, attempt: task.attempt - 1, status: 'uploading', uploaded: 95, total: 100, speed: 90 });
    expect(task.attempt).toBe(1);
    expect(task.uploaded).toBe(60);
    expect(task.speed).toBe(5);
  });

  it('重试后忽略上一轮事件，并保持新一轮进度单调增加', async () => {
    let resolveRetry!: (result: { code: number; data: string }) => void;
    mocks.uploadFileToCdn
      .mockRejectedValueOnce(new Error('网络中断'))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveRetry = resolve; }));
    const store = useUploadStore();
    await store.initialize();
    const task = store.enqueue('C:\\upload\\retry-progress.bin')!;
    await vi.waitFor(() => expect(task.status).toBe('failed'));

    store.retry(task.id);
    const newAttempt = task.attempt;
    await vi.waitFor(() => expect(mocks.uploadFileToCdn).toHaveBeenCalledTimes(2));
    store.applyNativeEvent({ taskId: task.id, attempt: newAttempt, status: 'uploading', uploaded: 70, total: 100, speed: 10 });
    store.applyNativeEvent({ taskId: task.id, attempt: newAttempt - 1, status: 'uploading', uploaded: 95, total: 100, speed: 90 });
    store.applyNativeEvent({ taskId: task.id, attempt: newAttempt, status: 'uploading', uploaded: 20, total: 100, speed: 5 });

    expect(task.status).toBe('uploading');
    expect(task.uploaded).toBe(70);
    expect(task.speed).toBe(5);
    resolveRetry({ code: 200, data: 'https://image.coolapk.com/retry-progress.bin' });
    await vi.waitFor(() => expect(task.status).toBe('completed'));
  });

  it('忽略完成、失败或取消终态后的迟到进度事件', () => {
    const store = useUploadStore();
    const completed = store.enqueue('C:\\upload\\completed.bin')!;
    const failed = store.enqueue('C:\\upload\\failed.bin')!;
    const cancelled = store.enqueue('C:\\upload\\cancelled.bin')!;

    store.applyNativeEvent({ taskId: completed.id, attempt: completed.attempt, status: 'completed', uploaded: 100, total: 100, url: 'https://image.coolapk.com/completed.bin' });
    store.applyNativeEvent({ taskId: failed.id, attempt: failed.attempt, status: 'failed', uploaded: 40, total: 100, error: '网络中断' });
    store.applyNativeEvent({ taskId: cancelled.id, attempt: cancelled.attempt, status: 'cancelled', uploaded: 30, total: 100 });

    store.applyNativeEvent({ taskId: completed.id, attempt: completed.attempt, status: 'uploading', uploaded: 10, total: 100, speed: 1 });
    store.applyNativeEvent({ taskId: failed.id, attempt: failed.attempt, status: 'uploading', uploaded: 80, total: 100, speed: 5 });
    store.applyNativeEvent({ taskId: cancelled.id, attempt: cancelled.attempt, status: 'uploading', uploaded: 90, total: 100, speed: 8 });

    expect(completed.status).toBe('completed');
    expect(completed.uploaded).toBe(100);
    expect(completed.url).toBe('https://image.coolapk.com/completed.bin');
    expect(failed.status).toBe('failed');
    expect(failed.uploaded).toBe(40);
    expect(failed.error).toBe('网络中断');
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.uploaded).toBe(30);
  });

  it('invoke 的迟到成功或失败结果不能覆盖已收到的终态事件', async () => {
    let resolveUpload!: (result: { code: number; data?: string; status?: string }) => void;
    let rejectUpload!: (error: Error) => void;
    mocks.uploadFileToCdn.mockImplementation(() => new Promise((resolve, reject) => {
      resolveUpload = resolve;
      rejectUpload = reject;
    }));
    const store = useUploadStore();
    await store.initialize();
    const task = store.enqueue('C:\\upload\\terminal.bin')!;
    await vi.waitFor(() => expect(mocks.uploadFileToCdn).toHaveBeenCalledTimes(1));

    store.applyNativeEvent({ taskId: task.id, attempt: task.attempt, status: 'completed', uploaded: 100, total: 100, url: 'https://image.coolapk.com/terminal.bin' });
    rejectUpload(new Error('迟到的 invoke 错误'));
    await vi.waitFor(() => expect(task.status).toBe('completed'));
    expect(task.error).toBe('');
    expect(task.url).toBe('https://image.coolapk.com/terminal.bin');

    // A completed event must also win over a delayed cancellation response.
    let resolveSecond!: (result: { code: number; status?: string }) => void;
    mocks.uploadFileToCdn.mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));
    const second = store.enqueue('C:\\upload\\terminal-second.bin')!;
    await vi.waitFor(() => expect(mocks.uploadFileToCdn).toHaveBeenCalledTimes(2));
    store.applyNativeEvent({ taskId: second.id, attempt: second.attempt, status: 'completed', uploaded: 100, total: 100, url: 'https://image.coolapk.com/terminal-second.bin' });
    resolveSecond({ code: 499, status: 'cancelled' });
    await vi.waitFor(() => expect(second.status).toBe('completed'));
    expect(second.url).toBe('https://image.coolapk.com/terminal-second.bin');
  });

  it('invoke 的迟到成功结果不能覆盖已收到的失败事件', async () => {
    let resolveUpload!: (result: { code: number; data: string }) => void;
    mocks.uploadFileToCdn.mockImplementation(() => new Promise((resolve) => { resolveUpload = resolve; }));
    const store = useUploadStore();
    await store.initialize();
    const task = store.enqueue('C:\\upload\\failed-terminal.bin')!;
    await vi.waitFor(() => expect(mocks.uploadFileToCdn).toHaveBeenCalledTimes(1));

    store.applyNativeEvent({ taskId: task.id, attempt: task.attempt, status: 'failed', uploaded: 40, total: 100, error: '服务端校验失败' });
    resolveUpload({ code: 200, data: 'https://image.coolapk.com/should-not-complete.bin' });

    await vi.waitFor(() => expect(task.status).toBe('failed'));
    expect(task.uploaded).toBe(40);
    expect(task.error).toBe('服务端校验失败');
    expect(task.url).toBe('');
  });
});
