/**
 * 网易易盾滑块人机验证集成模块
 * 对应酷安官方 APK 中的 NetEaseProtectSDKManager / wn.java 逻辑
 */

declare global {
  interface Window {
    initNECaptcha?: (
      config: NECaptchaConfig,
      onload?: (instance: NECaptchaInstance) => void,
      onerror?: (err: any) => void
    ) => void;
  }
}

export interface NECaptchaConfig {
  captchaId: string;
  element?: string | HTMLElement;
  mode?: 'float' | 'embed' | 'popup';
  apiVersion?: 2;
  width?: string | number;
  lang?: string;
  onReady?: (instance: NECaptchaInstance) => void;
  onVerify?: (err: any, data: { validate?: string; [key: string]: any }) => void;
  onClose?: () => void;
  [key: string]: any;
}

export interface NECaptchaInstance {
  verify: () => void;
  refresh: () => void;
  destroy: () => void;
}

/** 酷安官方网易易盾 Captcha ID */
export const DEFAULT_COOLAPK_CAPTCHA_ID = '414e5c9b866a03db03f860a1a9101672';

/**
 * 从酷安服务端响应中解析动态下发的 Captcha 配置（对应 APK C2143.java / wn.java）
 */
export function extractCaptchaParamsFromResponse(data: any): { captchaId?: string; captchaField?: string } | null {
  if (!data) return null;
  let extraStr = data.messageExtra || data.extra;
  if (!extraStr && typeof data === 'object') {
    if (data.captchaId) {
      return {
        captchaId: data.captchaId,
        captchaField: data.captchaField || '_v2_post_token',
      };
    }
  }
  if (typeof extraStr === 'string' && extraStr.trim().startsWith('{')) {
    try {
      const obj = JSON.parse(extraStr);
      if (obj.captchaId) {
        return {
          captchaId: obj.captchaId,
          captchaField: obj.captchaField || '_v2_post_token',
        };
      }
    } catch (e) {
      // ignore
    }
  }
  return null;
}

/** 从原生接口抛出的验证码响应中提取配置，兼容服务端只返回 code=403 的情况。 */
export function extractCaptchaParamsFromError(error: unknown): { captchaId: string; captchaField: string } | null {
  let response: any = error instanceof Error ? error.message : error;
  if (typeof response === 'string') {
    try { response = JSON.parse(response); } catch { return null; }
  }
  if (!response || typeof response !== 'object') return null;
  const params = extractCaptchaParamsFromResponse(response);
  if (params?.captchaId) return { captchaId: params.captchaId, captchaField: params.captchaField || '_v2_post_token' };
  const reason = [response.messageStatus, response.message, response.error].filter((value) => typeof value === 'string').join(' ');
  if (Number(response.code) === 403 && /(captcha|验证码)/i.test(reason)) {
    return { captchaId: DEFAULT_COOLAPK_CAPTCHA_ID, captchaField: '_v2_post_token' };
  }
  return null;
}

let scriptLoadingPromise: Promise<void> | null = null;
const SCRIPT_LOAD_TIMEOUT_MS = 15_000;

/**
 * 动态加载网易易盾 Web JS SDK
 */
export function loadNECaptchaScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('易盾验证码只能在浏览器环境运行'));
  }
  if (window.initNECaptcha) {
    return Promise.resolve();
  }
  if (scriptLoadingPromise) {
    return scriptLoadingPromise;
  }

  scriptLoadingPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src*="cstaticdun.126.net/load.min.js"]');
    const script = existing || document.createElement('script');
    let settled = false;
    // 旧标签可能已经触发过事件，统一设置超时，避免永远占用全文请求槽。
    const timeout = window.setTimeout(() => fail(new Error('网易易盾验证码脚本加载超时')), SCRIPT_LOAD_TIMEOUT_MS);
    const cleanup = () => {
      window.clearTimeout(timeout);
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      // 失败标签必须移除，下次调用才会发起新的脚本请求。
      script.remove();
      reject(error);
    };
    const onLoad = () => {
      if (settled) return;
      if (!window.initNECaptcha) {
        fail(new Error('网易易盾初始化函数不可用'));
        return;
      }
      settled = true;
      cleanup();
      resolve();
    };
    const onError = () => fail(new Error('网易易盾验证码脚本加载失败'));
    script.addEventListener('load', onLoad);
    script.addEventListener('error', onError);
    if (!existing) {
      script.src = 'https://cstaticdun.126.net/load.min.js';
      script.async = true;
      script.charset = 'utf-8';
      document.head.appendChild(script);
    }
  }).then(() => {
    scriptLoadingPromise = null;
  }, (error) => {
    scriptLoadingPromise = null;
    throw error;
  });

  return scriptLoadingPromise;
}

/**
 * 唤起网易易盾滑块弹窗并完成验证
 * @param captchaId 易盾业务 ID，默认使用酷安官方 ID
 * @returns 返回拼装后的官方标准 Token，格式为 `NEC:{captchaId前8位}:{validate}`
 */
export async function verifyWithCaptcha(captchaId = DEFAULT_COOLAPK_CAPTCHA_ID): Promise<string> {
  await loadNECaptchaScript();

  if (!window.initNECaptcha) {
    throw new Error('网易易盾初始化函数不可用');
  }

  return new Promise<string>((resolve, reject) => {
    // 创建一个隐藏的挂载容器
    const container = document.createElement('div');
    container.id = `ne-captcha-${Date.now()}`;
    container.style.position = 'fixed';
    container.style.zIndex = '99999';
    document.body.appendChild(container);

    let captchaInstance: NECaptchaInstance | null = null;
    let resolved = false;

    const cleanup = () => {
      try {
        if (captchaInstance) {
          captchaInstance.destroy();
        }
      } catch (e) {
        // ignore
      }
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    };

    window.initNECaptcha!(
      {
        captchaId,
        element: container,
        mode: 'popup',
        apiVersion: 2,
        width: '320px',
        lang: 'zh-CN',
        onReady: (instance) => {
          captchaInstance = instance;
        },
        onVerify: (err, data) => {
          if (err) {
            resolved = true;
            cleanup();
            reject(new Error(typeof err === 'string' ? err : err?.message || '验证码验证失败'));
            return;
          }
          if (data && data.validate) {
            resolved = true;
            const prefix = captchaId.slice(0, 8);
            const token = `NEC:${prefix}:${data.validate}`;
            cleanup();
            resolve(token);
          } else {
            resolved = true;
            cleanup();
            reject(new Error('验证码凭证无效'));
          }
        },
        onClose: () => {
          if (!resolved) {
            cleanup();
            reject(new Error('用户取消了人机验证'));
          }
        },
      },
      (instance) => {
        captchaInstance = instance;
        if (typeof instance.verify !== 'function') {
          resolved = true;
          cleanup();
          reject(new Error('易盾验证码实例不支持弹出验证'));
          return;
        }
        try {
          instance.verify();
        } catch (error) {
          resolved = true;
          cleanup();
          reject(error instanceof Error ? error : new Error('唤起易盾验证码失败'));
        }
      },
      (err) => {
        cleanup();
        reject(new Error(typeof err === 'string' ? err : err?.message || '初始化易盾滑块失败'));
      }
    );
  });
}
