import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  triggerSidebarTransition,
  resetSidebarTransition,
  useSidebarTransition,
  getFeedDetailTransition,
  officialFeedDetailEasing,
} from '../routeTransition';

describe('routeTransition', () => {
  it('保留官方两段贝塞尔路径的衔接点和端点', () => {
    expect(officialFeedDetailEasing).toMatch(/^linear\(0 0%,/);
    expect(officialFeedDetailEasing).toContain('0.4 16.6666%');
    expect(officialFeedDetailEasing).toMatch(/1 100%\)$/);
  });
  it('详情打开、历史返回与桌面使用对应过渡，其他栏目和同路由不触发', () => {
    expect(getFeedDetailTransition('/', '/feed/42', false, true)).toBe('feed-detail-forward');
    expect(getFeedDetailTransition('/feed/42', '/', true, true)).toBe('feed-detail-back');
    expect(getFeedDetailTransition('/feed/42', '/feed/41', true, true)).toBe('feed-detail-back');
    expect(getFeedDetailTransition('/', '/feed/42', false, false)).toBe('feed-detail-desktop');
    expect(getFeedDetailTransition('/feed/42', '/external', false, true)).toBe('');
    expect(getFeedDetailTransition('/', '/digital', false, true)).toBe('');
    expect(getFeedDetailTransition('/feed/42', '/feed/42', false, true)).toBe('');
  });
  beforeEach(() => {
    vi.useFakeTimers();
    resetSidebarTransition();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetSidebarTransition();
  });

  it('初始状态下侧边栏动效为未激活', () => {
    const { isSidebarTransitionActive } = useSidebarTransition();
    expect(isSidebarTransitionActive.value).toBe(false);
  });

  it('调用 triggerSidebarTransition 后激活动效并在超时后自动复位', () => {
    const { isSidebarTransitionActive } = useSidebarTransition();
    triggerSidebarTransition(500);
    expect(isSidebarTransitionActive.value).toBe(true);

    vi.advanceTimersByTime(499);
    expect(isSidebarTransitionActive.value).toBe(true);

    vi.advanceTimersByTime(2);
    expect(isSidebarTransitionActive.value).toBe(false);
  });

  it('手动调用 resetSidebarTransition 能立即复位状态并清理定时器', () => {
    const { isSidebarTransitionActive } = useSidebarTransition();
    triggerSidebarTransition(500);
    expect(isSidebarTransitionActive.value).toBe(true);

    resetSidebarTransition();
    expect(isSidebarTransitionActive.value).toBe(false);

    vi.advanceTimersByTime(600);
    expect(isSidebarTransitionActive.value).toBe(false);
  });
});
