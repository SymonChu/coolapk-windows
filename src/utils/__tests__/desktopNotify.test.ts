import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ invoke: vi.fn(), granted: vi.fn(), request: vi.fn(), send: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }));
vi.mock('@tauri-apps/plugin-notification', () => ({ isPermissionGranted: mocks.granted, requestPermission: mocks.request, sendNotification: mocks.send }));
import { desktopNotify } from '../desktopNotify';
describe('Android 通知授权', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('navigator', { userAgent: 'Android' });
    Object.assign(window, { __TAURI_INTERNALS__: {} });
    mocks.invoke.mockResolvedValue(undefined);
    mocks.granted.mockResolvedValue(false);
  });
  it('拒绝授权后不发送通知', async () => {
    mocks.request.mockResolvedValue('denied');
    await desktopNotify({ title: '通知' });
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it('首次授权后发送原生通知', async () => {
    mocks.request.mockResolvedValue('granted');
    await desktopNotify({ title: '通知' });
    expect(mocks.request).toHaveBeenCalledOnce();
    expect(mocks.invoke).toHaveBeenCalledWith('send_desktop_notification', { title: '通知', body: null,
      android: { category: 'comment', route: '/notifications', avatar: '', sound: false } });
  });
});
