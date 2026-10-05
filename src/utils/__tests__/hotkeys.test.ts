import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerGlobalHotkeys } from '../hotkeys';
import * as commentTracker from '../activeCommentTracker';

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
}));

vi.mock('../../stores/app', () => ({
  useAppStore: () => ({
    isSearchOpen: false,
    isPublishOpen: false,
    activeImageViewer: null,
    openPublish: vi.fn(),
  }),
}));

vi.mock('../../stores/settings', () => ({
  useSettingsStore: () => ({
    settings: { zoom: 100 },
    toggleSidebar: vi.fn(),
    setZoom: vi.fn(),
  }),
}));

describe('registerGlobalHotkeys', () => {
  let unregister: () => void;

  beforeEach(() => {
    commentTracker.resetActiveComments();
    unregister = registerGlobalHotkeys();
  });

  afterEach(() => {
    unregister();
    commentTracker.resetActiveComments();
  });

  it('dispatches feed-nav-comment when pressing c in non-typing target', () => {
    const listener = vi.fn();
    window.addEventListener('feed-nav-comment', listener);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true }));

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('feed-nav-comment', listener);
  });

  it('does not dispatch feed-nav-comment when pressing c in input target', () => {
    const listener = vi.fn();
    window.addEventListener('feed-nav-comment', listener);

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true }));

    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener('feed-nav-comment', listener);
    document.body.removeChild(input);
  });

  it('collapses active comments when pressing Escape', () => {
    const collapseFn = vi.fn();
    commentTracker.registerOpenComments('feed-1', collapseFn);

    expect(commentTracker.hasActiveComments()).toBe(true);

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    window.dispatchEvent(event);

    expect(collapseFn).toHaveBeenCalledTimes(1);
    expect(commentTracker.hasActiveComments()).toBe(false);
  });

  it('连续两次 Esc 不会收起屏幕外先前展开的评论', () => {
    const oldCollapse = vi.fn();
    const currentCollapse = vi.fn();
    commentTracker.registerOpenComments('old-feed', oldCollapse, () => false);
    commentTracker.registerOpenComments('current-feed', currentCollapse, () => true);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(currentCollapse).toHaveBeenCalledOnce();
    expect(oldCollapse).not.toHaveBeenCalled();
  });
});
