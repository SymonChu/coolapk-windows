interface ActiveCommentEntry {
  id: string | number;
  collapse: () => void;
  isVisible: () => boolean;
}

const activeCommentStack: ActiveCommentEntry[] = [];

/**
 * 注册已展开的评论区
 * @param id 动态 ID 或卡片唯一标识
 * @param collapse 收起评论区的回调函数
 * @returns 注销函数
 */
export function registerOpenComments(id: string | number, collapse: () => void, isVisible: () => boolean = () => true): () => void {
  // 先移除同 ID 的旧记录
  const existingIndex = activeCommentStack.findIndex((item) => String(item.id) === String(id));
  if (existingIndex >= 0) {
    activeCommentStack.splice(existingIndex, 1);
  }

  activeCommentStack.push({ id, collapse, isVisible });

  return () => {
    const idx = activeCommentStack.findIndex((item) => String(item.id) === String(id));
    if (idx >= 0) {
      activeCommentStack.splice(idx, 1);
    }
  };
}

/**
 * 将指定 ID 的评论区提升为当前最活跃项（例如用户点击或交互时）
 */
export function touchActiveComments(id: string | number): void {
  const idx = activeCommentStack.findIndex((item) => String(item.id) === String(id));
  if (idx >= 0) {
    const [entry] = activeCommentStack.splice(idx, 1);
    activeCommentStack.push(entry);
  }
}

/**
 * 检查当前是否有展开的评论区
 */
export function hasActiveComments(): boolean {
  return activeCommentStack.some(item => item.isVisible());
}

/** 判断评论所在卡片是否出现在当前视口，排除滚出屏幕或缓存页面里的旧评论。 */
export function isCommentHostVisible(element: HTMLElement | null | undefined): boolean {
  if (!element?.isConnected) return false;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0 || rect.right <= 0 || rect.left >= window.innerWidth) return false;
  let top = 0;
  let bottom = window.innerHeight;
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (!/(auto|scroll|overlay|hidden|clip)/.test(window.getComputedStyle(parent).overflowY)) continue;
    const bounds = parent.getBoundingClientRect();
    top = Math.max(top, bounds.top + parent.clientTop);
    bottom = Math.min(bottom, bounds.top + parent.clientTop + parent.clientHeight);
  }
  return bottom > top && rect.bottom > top && rect.top < bottom;
}

/**
 * 收起当前最活跃的评论区
 * @returns 是否成功收起
 */
export function collapseActiveComments(): boolean {
  // 连续 Esc 只处理当前可见的评论，不能沿栈关闭屏幕上方的旧帖子。
  const index = activeCommentStack.findLastIndex(item => item.isVisible());
  const top = index >= 0 ? activeCommentStack.splice(index, 1)[0] : undefined;
  if (top) {
    try {
      top.collapse();
      return true;
    } catch (err) {
      console.warn('收起评论区失败:', err);
    }
  }
  return false;
}

/**
 * 清空所有已注册项（主要用于测试重置）
 */
export function resetActiveComments(): void {
  activeCommentStack.length = 0;
}
