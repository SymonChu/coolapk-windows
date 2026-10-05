import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkLatestRelease, isNewerVersion, isVersionAllowedInChannel, versionFromAssetName } from '../updateChecker';

describe('测试版更新渠道', () => {
  beforeEach(() => vi.restoreAllMocks());
  const stable = { tag_name: 'v1.31.0', prerelease: false };
  const beta = { tag_name: 'v1.31.0-beta.101', prerelease: true };
  function mockReleases(releases: object[], latest = stable) {
    return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => ({
      ok: true, json: async () => String(url).endsWith('/latest') ? latest : releases,
    } as Response));
  }
  it('正式版接替测试版，并忽略列表顺序、草稿及非版本标签', async () => {
    mockReleases([beta, { tag_name: 'nightly' }, { tag_name: 'v9.9.9', draft: true }]);
    expect((await checkLatestRelease('beta', { os: 'ios', arch: 'aarch64' })).latestVersion).toBe('v1.31.0');
    expect(isNewerVersion('1.31.0', '1.31.0-beta.101')).toBe(true);
    expect(isNewerVersion('1.31.0-beta.102', '1.31.0-beta.101')).toBe(true);
  });
  it('按版本比较数字 beta 编号，并选择同版本 Android 包', async () => {
    mockReleases([beta, { tag_name: 'v1.32.0-beta.9', prerelease: true }, {
      tag_name: 'v1.32.0-beta.101', prerelease: true,
      assets: [{ name: 'coolapk-v1.32.0-beta.101-android-arm64.apk', browser_download_url: 'apk-url' }],
    }]);
    const result = await checkLatestRelease('beta', { os: 'android', arch: 'aarch64' });
    expect(result.latestVersion).toBe('v1.32.0-beta.101');
    expect(result.installerUrl).toBe('apk-url');
  });
  it('稳定渠道只读取正式版端点且拒绝预发布响应', async () => {
    const fetch = mockReleases([beta]);
    await checkLatestRelease('stable', { os: 'windows', arch: 'x86_64' });
    expect(fetch).toHaveBeenCalledTimes(1);
    mockReleases([beta], beta);
    await expect(checkLatestRelease('stable', { os: 'windows', arch: 'x86_64' })).rejects.toThrow();
  });
  it('关闭测试渠道后拒绝测试版本，保留正式版本', () => {
    expect(isVersionAllowedInChannel('1.31.0-beta.101', 'stable')).toBe(false);
    expect(isVersionAllowedInChannel('1.31.0', 'stable')).toBe(true);
    expect(isVersionAllowedInChannel('1.31.0-beta.101', 'beta')).toBe(true);
    expect(versionFromAssetName('coolapk-v1.31.0-beta.101-android-arm64.apk')).toBe('1.31.0-beta.101');
  });

  it('跳过缺少当前架构安装包的发布，选取可用版本', async () => {
    mockReleases([{ tag_name: 'v1.32.0-beta.1', prerelease: true, assets: [
      { name: 'coolapk-desktop_1.32.0-beta.1_arm64-setup.exe', browser_download_url: 'arm64' },
    ] }, { tag_name: 'v1.31.0-beta.101', prerelease: true, assets: [
      { name: 'coolapk-desktop_1.31.0-beta.101_x64-setup.exe', browser_download_url: 'x64' },
    ] }]);
    const result = await checkLatestRelease('beta', { os: 'windows', arch: 'x86_64' });
    expect(result.latestVersion).toBe('v1.31.0-beta.101');
    expect(result.installerUrl).toBe('x64');
  });
});
