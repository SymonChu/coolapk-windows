import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  registerOpenComments,
  collapseActiveComments,
  hasActiveComments,
  touchActiveComments,
  resetActiveComments,
  isCommentHostVisible,
} from '../activeCommentTracker';

describe('activeCommentTracker', () => {
  beforeEach(() => {
    resetActiveComments();
  });

  it('starts with no active comments', () => {
    expect(hasActiveComments()).toBe(false);
    expect(collapseActiveComments()).toBe(false);
  });

  it('registers and collapses active comments in LIFO order', () => {
    const collapse1 = vi.fn();
    const collapse2 = vi.fn();

    const unregister1 = registerOpenComments(101, collapse1);
    const unregister2 = registerOpenComments(102, collapse2);

    expect(hasActiveComments()).toBe(true);

    // Collapsing should collapse the most recently opened (102) first
    expect(collapseActiveComments()).toBe(true);
    expect(collapse2).toHaveBeenCalledTimes(1);
    expect(collapse1).not.toHaveBeenCalled();

    // Next collapse should collapse 101
    expect(collapseActiveComments()).toBe(true);
    expect(collapse1).toHaveBeenCalledTimes(1);

    // Now empty
    expect(hasActiveComments()).toBe(false);
    expect(collapseActiveComments()).toBe(false);

    unregister1();
    unregister2();
  });

  it('unregisters an entry when cleanup is called', () => {
    const collapse1 = vi.fn();
    const unregister = registerOpenComments(201, collapse1);

    expect(hasActiveComments()).toBe(true);
    unregister();
    expect(hasActiveComments()).toBe(false);
    expect(collapseActiveComments()).toBe(false);
    expect(collapse1).not.toHaveBeenCalled();
  });

  it('promotes an entry to top when touchActiveComments is called', () => {
    const collapse1 = vi.fn();
    const collapse2 = vi.fn();

    registerOpenComments(301, collapse1);
    registerOpenComments(302, collapse2);

    // Touch 301 to bring it to top
    touchActiveComments(301);

    expect(collapseActiveComments()).toBe(true);
    expect(collapse1).toHaveBeenCalledTimes(1);
    expect(collapse2).not.toHaveBeenCalled();
  });

  it('连续收起不会关闭屏幕外的旧评论，滚回后仍可正常收起', () => {
    const oldCollapse = vi.fn();
    const currentCollapse = vi.fn();
    let oldVisible = false;
    registerOpenComments('old', oldCollapse, () => oldVisible);
    registerOpenComments('current', currentCollapse, () => true);
    expect(collapseActiveComments()).toBe(true);
    expect(currentCollapse).toHaveBeenCalledOnce();
    expect(hasActiveComments()).toBe(false);
    expect(collapseActiveComments()).toBe(false);
    expect(oldCollapse).not.toHaveBeenCalled();
    oldVisible = true;
    expect(hasActiveComments()).toBe(true);
    expect(collapseActiveComments()).toBe(true);
    expect(oldCollapse).toHaveBeenCalledOnce();
  });

  it('跳过栈顶不可见的评论，选择当前视口里的评论', () => {
    const visibleCollapse = vi.fn();
    const hiddenCollapse = vi.fn();
    registerOpenComments('visible', visibleCollapse, () => true);
    registerOpenComments('hidden', hiddenCollapse, () => false);
    expect(collapseActiveComments()).toBe(true);
    expect(visibleCollapse).toHaveBeenCalledOnce();
    expect(hiddenCollapse).not.toHaveBeenCalled();
  });

  it('评论卡片可见性包含滚动容器裁剪，离开页面后视为不可见', () => {
    const host = document.createElement('div');
    host.style.overflowY = 'auto';
    Object.defineProperty(host, 'clientHeight', { value: 400 });
    host.getBoundingClientRect = () => ({ top: 100, bottom: 500 } as DOMRect);
    const card = document.createElement('article');
    let top = 550;
    card.getBoundingClientRect = () => ({ top, bottom: top + 100, left: 0, right: 100, width: 100, height: 100 } as DOMRect);
    host.appendChild(card);
    document.body.appendChild(host);
    try {
      expect(isCommentHostVisible(card)).toBe(false);
      top = 450;
      expect(isCommentHostVisible(card)).toBe(true);
      host.remove();
      expect(isCommentHostVisible(card)).toBe(false);
    } finally { host.remove(); }
  });
});
