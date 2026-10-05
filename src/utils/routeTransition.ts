import { ref } from 'vue';

const isSidebarTransitionActive = ref(false);

// 官方 FeedDetailActivityV8 继承 AppTheme 的 Android 窗口动画。
// 来自在线设备 Android 14 framework-res.apk 的 activity_open/close_*：
// 450ms，±96dp，fast_out_extra_slow_in 的两段 PathInterpolator 曲线。
// CSS linear() 的百分比停靠点按原始路径采样，保留两段曲线，不替换成普通 ease。
export const officialFeedDetailEasing = (() => {
  const points: string[] = [];
  const cubic = (a: number, b: number, c: number, d: number, t: number) =>
    (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t ** 2 * c + t ** 3 * d;
  const segments = [
    [0, 0, 0.05, 0, 0.133333, 0.06, 0.166666, 0.4],
    [0.166666, 0.4, 0.208333, 0.82, 0.25, 1, 1, 1],
  ];
  segments.forEach((segment, index) => {
    const [x0, y0, x1, y1, x2, y2, x3, y3] = segment as [number, number, number, number, number, number, number, number];
    for (let step = index ? 1 : 0; step <= 200; step++) {
      const t = step / 200;
      points.push(`${Number(cubic(y0, y1, y2, y3, t).toFixed(6))} ${Number((100 * cubic(x0, x1, x2, x3, t)).toFixed(6))}%`);
    }
  });
  return `linear(${points.join(',')})`;
})();

/** 只对动态详情的打开和历史返回应用页面过渡，不影响其他栏目切换。 */
export function getFeedDetailTransition(from: string, to: string, backward: boolean, mobile: boolean): string {
  if (from === to) return '';
  const entersDetail = /^\/feed\//.test(to);
  const returnsFromDetail = /^\/feed\//.test(from) && backward;
  if (!entersDetail && !returnsFromDetail) return '';
  if (!mobile) return 'feed-detail-desktop';
  return backward ? 'feed-detail-back' : 'feed-detail-forward';
}
let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 触发侧边栏导航平滑过渡动效
 * @param durationMs 超时自动回退时间，默认 600ms（覆盖 out-in 动画时长）
 */
export function triggerSidebarTransition(durationMs = 600): void {
  isSidebarTransitionActive.value = true;
  if (fallbackTimer) {
    clearTimeout(fallbackTimer);
  }
  fallbackTimer = setTimeout(() => {
    isSidebarTransitionActive.value = false;
    fallbackTimer = null;
  }, durationMs);
}

/**
 * 重置侧边栏路由过渡动效状态
 */
export function resetSidebarTransition(): void {
  if (fallbackTimer) {
    clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }
  isSidebarTransitionActive.value = false;
}

/**
 * 侧边栏导航过渡动效状态组合函数
 */
export function useSidebarTransition() {
  return {
    isSidebarTransitionActive,
    triggerSidebarTransition,
    resetSidebarTransition,
  };
}
