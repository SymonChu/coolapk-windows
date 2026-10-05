import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DEFAULT_COOLAPK_CAPTCHA_ID,
  extractCaptchaParamsFromError,
  loadNECaptchaScript,
  verifyWithCaptcha,
} from '../neteaseCaptcha';

describe('neteaseCaptcha', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.head.innerHTML = '';
    delete (window as any).initNECaptcha;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete window.initNECaptcha;
  });

  it('exports default coolapk captcha id', () => {
    expect(DEFAULT_COOLAPK_CAPTCHA_ID).toBe('414e5c9b866a03db03f860a1a9101672');
  });

  it('解析仅返回 403 的验证码响应，且不误判普通 403', () => {
    expect(extractCaptchaParamsFromError(JSON.stringify({ code: 403, messageStatus: 'err_request_captcha_v2' }))).toEqual({ captchaId: DEFAULT_COOLAPK_CAPTCHA_ID, captchaField: '_v2_post_token' });
    expect(extractCaptchaParamsFromError(JSON.stringify({ code: 403, message: '无权访问' }))).toBeNull();
  });

  it('loads the script tag into DOM', async () => {
    const promise = loadNECaptchaScript();
    const script = document.querySelector('script[src*="load.min.js"]');
    expect(script).toBeTruthy();

    (window as any).initNECaptcha = vi.fn();
    script?.dispatchEvent(new Event('load'));
    await promise;
  });

  it('脚本失败后移除标签，并让并发调用共享失败后重新加载', async () => {
    const first = loadNECaptchaScript();
    expect(loadNECaptchaScript()).toBe(first);
    const failure = expect(first).rejects.toThrow('脚本加载失败');
    const failedScript = document.querySelector('script')!;
    failedScript.dispatchEvent(new Event('error'));
    await failure;
    expect(failedScript.isConnected).toBe(false);

    const retry = loadNECaptchaScript();
    const newScript = document.querySelector('script')!;
    expect(newScript).not.toBe(failedScript);
    window.initNECaptcha = vi.fn();
    newScript.dispatchEvent(new Event('load'));
    await retry;
  });

  it.each([false, true])('脚本无事件时超时清理，已有标签=%s', async (existing) => {
    vi.useFakeTimers();
    if (existing) {
      // 模拟旧代码遗留的失败标签，历史 error 事件不会再次触发。
      const script = document.createElement('script');
      script.src = 'https://cstaticdun.126.net/load.min.js';
      document.head.appendChild(script);
      script.dispatchEvent(new Event('error'));
    }
    const failure = expect(loadNECaptchaScript()).rejects.toThrow('脚本加载超时');
    await vi.advanceTimersByTimeAsync(15_000);
    await failure;
    expect(document.querySelector('script')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);

    const retry = loadNECaptchaScript();
    window.initNECaptcha = vi.fn();
    document.querySelector('script')!.dispatchEvent(new Event('load'));
    await retry;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('脚本加载后没有初始化函数也会清理标签并允许重试', async () => {
    const failure = expect(loadNECaptchaScript()).rejects.toThrow('初始化函数不可用');
    document.querySelector('script')!.dispatchEvent(new Event('load'));
    await failure;
    expect(document.querySelector('script')).toBeNull();
  });

  it('resolves formatted token on successful validation', async () => {
    const verify = vi.fn();
    (window as any).initNECaptcha = vi.fn((config, onLoad) => {
      const mockInstance = {
        verify,
        refresh: vi.fn(),
        destroy: vi.fn(),
      };
      if (onLoad) onLoad(mockInstance);
      if (config.onReady) config.onReady(mockInstance);
      // Simulate verify success
      if (config.onVerify) {
        config.onVerify(null, { validate: 'mock_validate_hash_12345' });
      }
    });

    const token = await verifyWithCaptcha('414e5c9b866a03db03f860a1a9101672');
    expect(token).toBe('NEC:414e5c9b:mock_validate_hash_12345');
    expect(verify).toHaveBeenCalledOnce();
    expect(window.initNECaptcha).toHaveBeenCalledWith(expect.objectContaining({ mode: 'popup', apiVersion: 2 }), expect.any(Function), expect.any(Function));
  });

  it('rejects on user cancellation or verify error', async () => {
    (window as any).initNECaptcha = vi.fn((config, onLoad) => {
      const mockInstance = {
        verify: vi.fn(),
        refresh: vi.fn(),
        destroy: vi.fn(),
      };
      if (onLoad) onLoad(mockInstance);
      if (config.onClose) {
        config.onClose();
      }
    });

    await expect(verifyWithCaptcha()).rejects.toThrow('用户取消了人机验证');
  });
});
