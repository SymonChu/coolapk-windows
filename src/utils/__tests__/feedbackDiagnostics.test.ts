import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ invoke: vi.fn(), uploadImage: vi.fn(), getImageDataUrl: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }));
vi.mock('../../api/coolapk', () => ({ CoolapkTauriAPI: mocks }));
import { getDiagnosticLink, normalizeDiagnosticImageUrl, sanitizeFeedbackLogs, readDiagnosticImageUrl, uploadFeedbackDiagnosticImage } from '../feedbackDiagnostics';
import { packDiagnosticImage, MAX_DIAGNOSTIC_LOG_BYTES } from '../diagnosticImage';

describe('feedback diagnostic links', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());
  it('removes credentials, private bodies, URL queries and user paths, retaining request timing', () => {
    const log = sanitizeFeedbackLogs('[WARN] Cookie: uid=123; SESSID=secret\n[INFO] request elapsed_ms=9200 https://api.coolapk.com/v6/feed/detail?token=secret\n[ERROR] C:\\Users\\Alice\\app token=secret message=private message\n[WARN] {"_v2_post_token":"secret"}\n[WARN] {"message":"private message"}\nheartbeat uptime_s=30');
    expect(log).toContain('elapsed_ms=9200');
    expect(log).not.toMatch(/secret|Alice|private message|heartbeat|uid=123/);
  });
  it('limits bytes without breaking UTF-8', () => {
    const log = sanitizeFeedbackLogs(Array.from({ length: 3000 }, () => '中'.repeat(1000)).join('\n'));
    expect(new TextEncoder().encode(log).length).toBeLessThanOrEqual(MAX_DIAGNOSTIC_LOG_BYTES);
    expect(log).not.toContain('\ufffd');
  });
  it('permits only raw CoolAPK feed PNG addresses', () => {
    expect(normalizeDiagnosticImageUrl('http://image.coolapk.com/feed/2026/test.png')).toBe('https://image.coolapk.com/feed/2026/test.png');
    for (const url of ['https://evil.com/feed/test.png', 'https://image.coolapk.com.evil.com/feed/test.png', 'https://user:pass@image.coolapk.com/feed/test.png', 'https://image.coolapk.com/feed/test.png.m.jpg', 'https://image.coolapk.com/feed/test.png?token=secret']) {
      expect(() => normalizeDiagnosticImageUrl(url)).toThrow();
    }
  });
  it('recognizes the report link in a received text message', () => {
    expect(getDiagnosticLink('反馈\n- 诊断日志图片：http://image.coolapk.com/feed/test.png\n操作步骤')).toBe('https://image.coolapk.com/feed/test.png');
    expect(getDiagnosticLink('https://image.coolapk.com/feed/test.png')).toBe('');
    expect(getDiagnosticLink('诊断日志图片：<a href="https://image.coolapk.com/feed/test.png">https://image.coolapk.com/feed/test.png</a>')).toBe('https://image.coolapk.com/feed/test.png');
  });
  it('fetches the original bytes through native networking and verifies the ZIP', async () => {
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII='), c => c.charCodeAt(0));
    const packed = packDiagnosticImage(png, { version: '1.28.0', platform: 'Android', createdAt: '2026-10-01', log: 'test log' });
    mocks.getImageDataUrl.mockResolvedValue(`data:image/png;base64,${btoa(String.fromCharCode(...packed))}`);
    expect((await readDiagnosticImageUrl('http://image.coolapk.com/feed/test.png')).log).toBe('test log');
    expect(mocks.getImageDataUrl).toHaveBeenCalledWith('https://image.coolapk.com/feed/test.png');
  });

  function mockCoverAndLogs() {
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII='), c => c.charCodeAt(0));
    vi.spyOn(document, 'createElement').mockReturnValue({
      getContext: () => ({ fillRect: vi.fn(), fillText: vi.fn() }),
      toBlob: (callback: (value: unknown) => void) => callback({ arrayBuffer: async () => png.buffer }),
    } as any);
    mocks.invoke.mockResolvedValue({ content: '[WARN] request elapsed_ms=4321' });
    mocks.uploadImage.mockResolvedValue({ data: 'http://image.coolapk.com/feed/test.png' });
  }

  it('uploads untouched packed bytes and verifies a full original download before returning its link', async () => {
    mockCoverAndLogs();
    mocks.getImageDataUrl.mockImplementation(async () => {
      const bytes = mocks.uploadImage.mock.calls[0]![0] as Uint8Array;
      return `data:image/png;base64,${btoa(String.fromCharCode(...bytes))}`;
    });
    expect(await uploadFeedbackDiagnosticImage()).toBe('https://image.coolapk.com/feed/test.png');
    const cover = vi.mocked(document.createElement).mock.results[0]!.value as HTMLCanvasElement;
    expect([cover.width, cover.height]).toEqual([64, 64]);
    expect(mocks.uploadImage.mock.calls[0]!.slice(2)).toEqual(['image/png', 'feed']);
    expect((await readDiagnosticImageUrl('https://image.coolapk.com/feed/test.png')).log).toContain('elapsed_ms=4321');
  });

  it('rejects uploads whose downloaded image lost the ZIP payload', async () => {
    mockCoverAndLogs();
    mocks.getImageDataUrl.mockResolvedValue('data:image/png;base64,YWJj');
    await expect(uploadFeedbackDiagnosticImage()).rejects.toThrow();
  });
});
