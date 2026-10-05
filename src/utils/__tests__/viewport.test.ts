import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  APP_VIEWPORT_HEIGHT_VAR,
  APP_VIEWPORT_TOP_VAR,
  KEYBOARD_INSET_VAR,
  applyViewportMetrics,
  measureViewport,
  setupKeyboardScrollAssist,
  setupViewportHeight,
} from '../viewport';

interface FakeViewport {
  height: number;
  offsetTop: number;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

function installVisualViewport(height: number, offsetTop = 0) {
  const listeners = new Map<string, Set<() => void>>();
  const viewport: FakeViewport = {
    height,
    offsetTop,
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
  };
  Object.defineProperty(window, 'visualViewport', {
    value: viewport,
    configurable: true,
    writable: true,
  });
  return {
    viewport,
    emit(type: string) {
      listeners.get(type)?.forEach((listener) => listener());
    },
    listenerCount(type: string) {
      return listeners.get(type)?.size ?? 0;
    },
  };
}

describe('viewport 键盘适配', () => {
  beforeEach(() => {
    delete (window as unknown as { visualViewport?: unknown }).visualViewport;
  });

  afterEach(() => {
    delete (window as unknown as { visualViewport?: unknown }).visualViewport;
    document.documentElement.style.removeProperty(APP_VIEWPORT_HEIGHT_VAR);
    document.documentElement.style.removeProperty(APP_VIEWPORT_TOP_VAR);
    document.documentElement.style.removeProperty(KEYBOARD_INSET_VAR);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('没有 visualViewport 时按布局视口计算且不计键盘遮挡', () => {
    expect(measureViewport({ innerHeight: 852, visualViewport: null })).toEqual({
      height: 852,
      top: 0,
      keyboardInset: 0,
    });
  });

  it('键盘弹出时用可视高度并算出遮挡高度', () => {
    expect(measureViewport({ innerHeight: 852, visualViewport: { height: 516 } })).toEqual({
      height: 516,
      top: 0,
      keyboardInset: 336,
    });
  });

  it('可视视口比布局视口更大时取布局视口，不产生负数遮挡', () => {
    expect(measureViewport({ innerHeight: 600, visualViewport: { height: 900 } })).toEqual({
      height: 600,
      top: 0,
      keyboardInset: 0,
    });
  });

  it('iOS 把整页顶上去时带出可视视口偏移，弹窗才能贴合可见区域', () => {
    expect(measureViewport({ innerHeight: 852, visualViewport: { height: 516, offsetTop: 240 } }))
      .toEqual({ height: 516, top: 240, keyboardInset: 336 });
  });

  it('把度量写入 CSS 变量', () => {
    const root = document.createElement('div');
    applyViewportMetrics({ height: 516, top: 240, keyboardInset: 336 }, root);
    expect(root.style.getPropertyValue(APP_VIEWPORT_HEIGHT_VAR)).toBe('516px');
    expect(root.style.getPropertyValue(APP_VIEWPORT_TOP_VAR)).toBe('240px');
    expect(root.style.getPropertyValue(KEYBOARD_INSET_VAR)).toBe('336px');
  });

  it('订阅后立即同步，并在可视视口变化时更新', () => {
    const layoutHeight = window.innerHeight;
    const fake = installVisualViewport(layoutHeight);
    const stop = setupViewportHeight();

    expect(document.documentElement.style.getPropertyValue(APP_VIEWPORT_HEIGHT_VAR))
      .toBe(`${layoutHeight}px`);
    expect(document.documentElement.style.getPropertyValue(KEYBOARD_INSET_VAR)).toBe('0px');

    fake.viewport.height = layoutHeight - 352;
    fake.emit('resize');
    expect(document.documentElement.style.getPropertyValue(APP_VIEWPORT_HEIGHT_VAR))
      .toBe(`${layoutHeight - 352}px`);
    expect(document.documentElement.style.getPropertyValue(KEYBOARD_INSET_VAR)).toBe('352px');

    stop();
    expect(fake.listenerCount('resize')).toBe(0);
  });

  it('键盘弹出时把编辑框所在组合框滚进可视范围', () => {
    vi.useFakeTimers();
    const fake = installVisualViewport(852);
    const composer = document.createElement('div');
    composer.className = 'comment-composer-box';
    const textarea = document.createElement('textarea');
    composer.appendChild(textarea);
    document.body.appendChild(composer);
    const scrollIntoView = vi.fn();
    composer.scrollIntoView = scrollIntoView;

    const stop = setupKeyboardScrollAssist();
    textarea.focus();

    fake.viewport.height = 500;
    fake.emit('resize');
    expect(scrollIntoView).not.toHaveBeenCalled();

    vi.advanceTimersByTime(120);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' });

    stop();
    composer.remove();
  });

  it('高度只是小幅变化时不触发滚动', () => {
    vi.useFakeTimers();
    const fake = installVisualViewport(852);
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    const scrollIntoView = vi.fn();
    textarea.scrollIntoView = scrollIntoView;
    const stop = setupKeyboardScrollAssist();
    textarea.focus();

    fake.viewport.height = 820;
    fake.emit('resize');
    vi.advanceTimersByTime(200);

    expect(scrollIntoView).not.toHaveBeenCalled();
    stop();
    textarea.remove();
  });

  it('没有聚焦输入框时键盘弹出不滚动页面', () => {
    vi.useFakeTimers();
    const fake = installVisualViewport(852);
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const stop = setupKeyboardScrollAssist();
    expect(document.activeElement instanceof HTMLInputElement
      || document.activeElement instanceof HTMLTextAreaElement).toBe(false);

    fake.viewport.height = 500;
    fake.emit('resize');
    vi.advanceTimersByTime(200);

    expect(scrollIntoView).not.toHaveBeenCalled();
    stop();
  });
});
