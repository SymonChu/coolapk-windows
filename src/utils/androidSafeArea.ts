import { invoke, isTauri } from '@tauri-apps/api/core';

// Android 顶部安全区兜底：页面就绪后由前端主动向原生拉取状态栏高度并写入 CSS 变量。
// 原生 insets 回调的注入发生在 WebView 生命周期早期，若早于页面文档创建就会丢失；
// 前端在 DOM 就绪后拉取一次（并在转屏/窗口尺寸变化时重拉），保证变量一定落在当前文档上。

function isAndroidTauri(): boolean {
  return isTauri() && typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
}

function applySafeArea(pixels: number): void {
  const density = window.devicePixelRatio || 1;
  const value = `${(pixels / density).toFixed(2)}px`;
  document.documentElement.style.setProperty('--android-safe-area-top', value);
}

async function fetchAndApply(): Promise<void> {
  if (!isAndroidTauri()) return;
  try {
    const pixels = await invoke<number>('get_android_safe_area_top');
    if (typeof pixels === 'number' && Number.isFinite(pixels) && pixels >= 0) applySafeArea(pixels);
  } catch (error) {
    // 拉取失败不阻塞启动：insets 回调注入仍可能已经生效。
    console.warn('拉取 Android 顶部安全区失败:', error);
  }
}

let installed = false;

export function setupAndroidSafeArea(): void {
  if (installed || !isAndroidTauri()) return;
  installed = true;
  // DOM 就绪后立即拉取；再在转屏/尺寸变化时重拉（原生 insets 注入也会同步，双保险）。
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { void fetchAndApply(); }, { once: true });
  } else {
    void fetchAndApply();
  }
  window.addEventListener('resize', () => { void fetchAndApply(); }, { passive: true });
  window.addEventListener('orientationchange', () => {
    // 转屏后原生 insets 与 WebView 尺寸都需要时间稳定，稍等一拍再拉。
    window.setTimeout(() => { void fetchAndApply(); }, 300);
  }, { passive: true });
}
