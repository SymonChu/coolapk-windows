import { afterEach, describe, it, expect, vi } from 'vitest';
import { DEVELOPER_UID, FEEDBACK_ISSUES_URL, getFeedbackTemplate, openFeedbackMessage } from '../feedback';

const mocks = vi.hoisted(() => ({ openUrl: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../api/coolapk', () => ({ CoolapkTauriAPI: { openUrl: mocks.openUrl } }));

afterEach(() => {
  vi.unstubAllGlobals();
  mocks.openUrl.mockClear();
});

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

  it('不再指向任何上游作者的私信 UID', () => {
    expect(DEVELOPER_UID).toBe('0');
  });

  it('生成包含版本号和系统的反馈模版', () => {
    const template = getFeedbackTemplate();
    expect(template).toContain('【问题反馈】');
    expect(template).toContain('客户端版本：');
    expect(template).toContain('操作系统：');
    expect(template).toContain('问题描述：');
  });

  it('未登录也直接跳转本项目 GitHub Issues（不再走私信）', () => {
    const router = { push: vi.fn() } as any;
    const openLoginModal = vi.fn();
    openFeedbackMessage(router, { isLoggedIn: false, openLoginModal });

    expect(mocks.openUrl).toHaveBeenCalledTimes(1);
    expect(String(mocks.openUrl.mock.calls[0][0])).toContain(FEEDBACK_ISSUES_URL);
    expect(mocks.openUrl.mock.calls[0][1]).toBe('system');
    expect(openLoginModal).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('反馈链接带上版本号与问题模版正文', () => {
    const router = { push: vi.fn() } as any;
    openFeedbackMessage(router, { isLoggedIn: true });

    const url = decodeURIComponent(String(mocks.openUrl.mock.calls[0][0]));
    expect(url).toContain('客户端版本：');
    expect(url).toContain('问题描述：');
    expect(router.push).not.toHaveBeenCalled();
  });
});
