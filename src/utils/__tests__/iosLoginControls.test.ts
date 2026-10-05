import script from '../../../src-tauri/src/coolapk/ios-login-controls.js?raw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const execute = new Function('window', 'document', 'location', 'MutationObserver', 'setTimeout', script);

describe('iOS 官方登录页返回入口', () => {
  const observers: MutationObserver[] = [];
  const roots: ShadowRoot[] = [];
  let location: { protocol: string; hostname: string; href: string };

  beforeEach(() => {
    vi.useFakeTimers();
    location = { protocol: 'https:', hostname: 'account.coolapk.com', href: 'https://account.coolapk.com/auth/login' };
    const attach = HTMLElement.prototype.attachShadow;
    vi.spyOn(HTMLElement.prototype, 'attachShadow').mockImplementation(function (this: HTMLElement, options) {
      const root = attach.call(this, options);
      roots.push(root);
      return root;
    });
  });

  afterEach(() => {
    observers.forEach((observer) => observer.disconnect());
    observers.length = 0;
    roots.length = 0;
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function run() {
    class Observer extends MutationObserver {
      constructor(callback: MutationCallback) { super(callback); observers.push(this); }
    }
    execute(window, document, location, Observer, window.setTimeout.bind(window));
  }

  it('官网样式不影响返回按钮，点击发出固定导航而不调用远程 IPC', () => {
    run();
    const button = roots[0].querySelector('button')!;
    expect(button.textContent).toBe('返回应用');
    button.click();
    expect(location.href).toBe('coolapk-login://return');
    expect(button.disabled).toBe(true);
    vi.advanceTimersByTime(8000);
    expect(button.disabled).toBe(false);
  });

  it('官网替换页面节点后恢复按钮且不会重复添加', async () => {
    run();
    document.getElementById('coolapk-ios-login-return')!.remove();
    await Promise.resolve();
    expect(document.querySelectorAll('#coolapk-ios-login-return')).toHaveLength(1);
    document.dispatchEvent(new Event('DOMContentLoaded'));
    expect(document.querySelectorAll('#coolapk-ios-login-return')).toHaveLength(1);
  });

  it.each(['evil.test', 'account.coolapk.com.evil.test'])('第三方页面不注入入口：%s', (hostname) => {
    location.hostname = hostname;
    run();
    expect(roots).toHaveLength(0);
  });

  it('页面能报出安全区时按安全区往下让', () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect')
      .mockReturnValue({ height: 59 } as unknown as DOMRect);
    run();
    // 59（安全区）+ 8（余量），旧写法会直接落在状态栏下面。
    expect(document.getElementById('coolapk-ios-login-return')!.style.top).toBe('67px');
  });

  it('官网没有 viewport-fit 时按屏幕尺寸兜底，不会被状态栏压掉一半', () => {
    // jsdom 里量不到 env()，正好等价于官网不声明 viewport-fit=cover 的真机情况。
    vi.spyOn(Element.prototype, 'getBoundingClientRect')
      .mockReturnValue({ height: 0 } as unknown as DOMRect);
    Object.defineProperty(window, 'screen', {
      value: { width: 393, height: 852 },
      configurable: true,
    });
    run();
    expect(document.getElementById('coolapk-ios-login-return')!.style.top).toBe('56px');
  });
});
