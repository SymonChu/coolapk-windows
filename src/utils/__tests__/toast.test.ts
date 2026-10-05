import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { showToast } from '../toast';

describe('toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('多个操作按钮分别执行自己的回调', () => {
    const download = vi.fn();
    const dismiss = vi.fn();
    showToast('编码不支持', 'warning', 10000, [
      { label: '下载扩展', onClick: download },
      { label: '不再提醒', onClick: dismiss },
    ]);
    const buttons = document.querySelectorAll<HTMLButtonElement>('.app-toast-action');
    expect(buttons).toHaveLength(2);
    buttons[0].click();
    expect(download).toHaveBeenCalledOnce();
    expect(dismiss).not.toHaveBeenCalled();
  });

  it('支持操作按钮并在点击后关闭提示', () => {
    const onClick = vi.fn();

    showToast('编码不支持', 'warning', 10000, { label: '不再提醒', onClick });

    const actionButton = document.querySelector<HTMLButtonElement>('.app-toast-action');
    expect(actionButton?.textContent).toBe('不再提醒');
    actionButton?.click();

    expect(onClick).toHaveBeenCalledOnce();
    expect(document.querySelector('.app-toast')?.classList.contains('is-leaving')).toBe(true);
    vi.advanceTimersByTime(220);
    expect(document.querySelector('.app-toast')).toBeNull();
  });
});
