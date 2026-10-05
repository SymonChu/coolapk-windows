import { afterEach, describe, it, expect, vi } from 'vitest';
import { DEVELOPER_UID, getFeedbackTemplate, openFeedbackMessage } from '../feedback';

afterEach(() => vi.unstubAllGlobals());

describe('feedback utils', () => {
  it.each([
    ['Mozilla/5.0 (Linux; Android 14)', 'Android'],
    ['Mozilla/5.0 (Linux; android 14)', 'Android'],
    ['Mozilla/5.0 (X11; Linux x86_64)', 'Linux'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Windows'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'macOS'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 'iOS'],
    ['Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)', 'iOS'],
    ['Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X)', 'iOS'],
  ])('系统识别：%s → %s', (userAgent, osName) => {
    vi.stubGlobal('navigator', { userAgent });
    expect(getFeedbackTemplate()).toContain(`- 操作系统：${osName}\n`);
  });

  it.each([
    [5, 'iOS'],
    [0, 'macOS'],
  ])('Macintosh UA 的触摸点数为 %s 时识别为 %s', (maxTouchPoints, osName) => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      maxTouchPoints,
    });
    expect(getFeedbackTemplate()).toContain(`- 操作系统：${osName}\n`);
  });

  it('开发者 UID 正确', () => {
    expect(DEVELOPER_UID).toBe('1451266');
  });

  it('生成包含版本号和系统的反馈模版', () => {
    const template = getFeedbackTemplate();
    expect(template).toContain('【酷安客户端问题反馈】');
    expect(template).toContain('客户端版本：');
    expect(template).toContain('操作系统：');
    expect(template).toContain('问题描述：');
  });

  it('未登录时触发 openLoginModal', () => {
    const router = { push: vi.fn() } as any;
    const openLoginModal = vi.fn();
    openFeedbackMessage(router, { isLoggedIn: false, openLoginModal });

    expect(openLoginModal).toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('已登录时跳转 /messages 并携带开发者 UID 与模版', () => {
    const router = { push: vi.fn() } as any;
    openFeedbackMessage(router, { isLoggedIn: true });

    expect(router.push).toHaveBeenCalledWith(expect.objectContaining({
      path: '/messages',
      query: expect.objectContaining({
        uid: '1451266',
        initialText: expect.stringContaining('【酷安客户端问题反馈】'),
      }),
    }));
  });
});
