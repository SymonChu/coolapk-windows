import type { Router } from 'vue-router';

/**
 * 「首页」入口的单击 / 双击行为。
 *
 * 侧边栏和移动端底栏两处「首页」共用同一套判据，避免出现
 * 「底栏能双击刷新、侧边栏不能」这类不一致。
 *
 * - 单击：回到顶部；
 * - 双击：回到顶部并刷新当前栏目（取该栏目第一页最新内容）。
 */

/** 双击判定的时间窗口（毫秒）。 */
export const HOME_TAB_DOUBLE_CLICK_MS = 360;

/** 单击「首页」：让首页滚动到顶部。 */
export const HOME_TAB_SCROLL_TOP_EVENT = 'home-tab-scroll-top';

/** 双击「首页」：回到顶部后刷新当前栏目。 */
export const HOME_TAB_REFRESH_EVENT = 'home-tab-refresh';

export type HomeTabClickResult = 'single' | 'double' | 'navigate';

let lastHomeTabClickAt = 0;

/** 纯判据：上一次点击时间与本次点击时间是否构成双击。 */
export function isHomeTabDoubleClick(previousClickAt: number, currentClickAt: number): boolean {
  return previousClickAt > 0 && currentClickAt - previousClickAt < HOME_TAB_DOUBLE_CLICK_MS;
}

/** 清空双击判定状态；离开首页或测试之间隔离时调用。 */
export function resetHomeTabClickState(): void {
  lastHomeTabClickAt = 0;
}

/**
 * 处理一次「首页」点击。
 *
 * - 不在首页：跳回首页。此时清空双击状态，否则「从子页返回」加上紧接着的一次点击
 *   会被误判成双击，导致刚返回就发一次刷新请求；
 * - 已在首页：派发回到顶部事件；360 毫秒内的第二次点击再派发一次刷新事件。
 *
 * 回到顶部在每次点击时立即派发，不为等待双击而延迟，所以单击没有手感延迟。
 */
export function activateHomeTab(
  router: Router | undefined,
  options: { replace?: boolean } = {}
): HomeTabClickResult {
  if (!router) return 'navigate';

  if (router.currentRoute.value.path !== '/') {
    resetHomeTabClickState();
    if (options.replace) void router.replace('/');
    else void router.push('/');
    return 'navigate';
  }

  const now = Date.now();
  const isDouble = isHomeTabDoubleClick(lastHomeTabClickAt, now);
  // 双击命中后清空状态，避免第三击再次触发刷新。
  lastHomeTabClickAt = isDouble ? 0 : now;

  window.dispatchEvent(new Event(HOME_TAB_SCROLL_TOP_EVENT));
  if (isDouble) window.dispatchEvent(new Event(HOME_TAB_REFRESH_EVENT));

  return isDouble ? 'double' : 'single';
}
