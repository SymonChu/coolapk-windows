import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isNewerVersion,
  isUpdateAssetCompatible,
  checkLatestRelease,
  normalizeVersion,
  selectInstallerAsset,
  selectPortableAsset,
  shouldReplaceDownloadedUpdate,
  versionFromAssetName,
} from '../updateChecker';

describe('updateChecker', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('isNewerVersion', () => {
    it('returns true when latest is greater than current', () => {
      expect(isNewerVersion('1.4.6', '1.4.5')).toBe(true);
      expect(isNewerVersion('v1.5.0', '1.4.5')).toBe(true);
      expect(isNewerVersion('2.0.0', '1.9.9')).toBe(true);
    });

    it('returns false when latest is equal or lower than current', () => {
      expect(isNewerVersion('1.4.5', '1.4.5')).toBe(false);
      expect(isNewerVersion('1.4.4', '1.4.5')).toBe(false);
      expect(isNewerVersion('v1.3.9', '1.4.5')).toBe(false);
    });

    it('compares prerelease versions using semver rules', () => {
      expect(isNewerVersion('1.5.0-beta.2', '1.5.0-beta.1')).toBe(true);
      expect(isNewerVersion('1.5.0', '1.5.0-beta.9')).toBe(true);
      expect(isNewerVersion('1.5.0-beta.1', '1.5.0')).toBe(false);
    });

    it('rejects malformed versions instead of treating them as zeroes', () => {
      expect(isNewerVersion('1.x.0', '1.0.0')).toBe(false);
      expect(isNewerVersion('release-latest', '1.0.0')).toBe(false);
      expect(normalizeVersion('v2.3.4+build.7')).toBe('2.3.4');
      expect(normalizeVersion('not-a-version')).toBeNull();
    });
  });

  describe('versionFromAssetName', () => {
    it.each([
      'coolapk-desktop_1.29.0_x64.dmg',
      'coolapk-desktop_1.29.0_aarch64-123-456.dmg',
      'coolapk-desktop_1.29.0_amd64.AppImage',
      'coolapk-desktop_1.29.0_amd64-123-456.appimage',
      'coolapk-desktop_1.29.0_arm64.deb',
      'coolapk-desktop-1.29.0-1.x86_64.rpm',
      'coolapk-desktop-1.29.0-1.x86_64-123-456.rpm',
    ])('extracts macOS/Linux release and cached package versions: %s', (name) => {
      expect(versionFromAssetName(name)).toBe('1.29.0');
    });

    it('preserves prerelease versions in macOS and RPM package names', () => {
      expect(versionFromAssetName('coolapk-desktop_1.29.0-beta.2_aarch64.dmg')).toBe('1.29.0-beta.2');
      expect(versionFromAssetName('coolapk-desktop-1.29.0-beta.2-1.x86_64.rpm')).toBe('1.29.0-beta.2');
    });
    it('extracts versions from downloaded files with updater suffixes', () => {
      expect(versionFromAssetName('coolapk-desktop_1.20.2_x64-portable-123-456.exe'))
        .toBe('1.20.2');
      expect(versionFromAssetName('coolapk-desktop_1.20.2_x64-setup-123-456.exe'))
        .toBe('1.20.2');
    });
  });

  describe('isUpdateAssetCompatible', () => {
    it('rejects mismatched Linux package types and architectures', () => {
      const platform = { os: 'linux', arch: 'x86_64' };
      expect(isUpdateAssetCompatible('coolapk-desktop_1.29.0_amd64.deb', platform, 'deb')).toBe(true);
      expect(isUpdateAssetCompatible('coolapk-desktop_1.29.0_amd64.deb', platform, 'portable')).toBe(false);
      expect(isUpdateAssetCompatible('coolapk-desktop_1.29.0_arm64.deb', platform, 'deb')).toBe(false);
      expect(isUpdateAssetCompatible('coolapk-desktop_1.29.0_amd64.AppImage', platform, 'unsupported')).toBe(false);
      expect(isUpdateAssetCompatible('coolapk-desktop_1.29.0_amd64.AppImage', platform, 'installer')).toBe(false);
    });
    it('validates architecture and package type for cached updater file names', () => {
      const platform = { os: 'windows' as const, arch: 'x86_64' as const };
      expect(isUpdateAssetCompatible(
        'coolapk-desktop_1.20.2_x64-portable-123-456.exe',
        platform,
        'portable'
      )).toBe(true);
      expect(isUpdateAssetCompatible(
        'coolapk-desktop_1.20.2_arm64-portable-123-456.exe',
        platform,
        'portable'
      )).toBe(false);
      expect(isUpdateAssetCompatible(
        'coolapk-desktop_1.20.2_x64-setup-123-456.exe',
        platform,
        'portable'
      )).toBe(false);
    });
  });

  describe('shouldReplaceDownloadedUpdate', () => {
    it('reuses the downloaded package when GitHub is unavailable or not newer', () => {
      expect(shouldReplaceDownloadedUpdate('1.20.2', '', false)).toBe(false);
      expect(shouldReplaceDownloadedUpdate('1.20.2', '1.20.2', true)).toBe(false);
      expect(shouldReplaceDownloadedUpdate('1.20.2', '1.20.1', true)).toBe(false);
      expect(shouldReplaceDownloadedUpdate('1.20.2', 'invalid', true)).toBe(false);
    });

    it('replaces it only when GitHub has a newer compatible package', () => {
      expect(shouldReplaceDownloadedUpdate('1.20.2', '1.20.3', true)).toBe(true);
      expect(shouldReplaceDownloadedUpdate('1.20.2', '1.20.3', false)).toBe(false);
    });
  });

  describe('checkLatestRelease', () => {
    it.each([
      ['macos', 'x86_64', 'installer', 'coolapk-desktop_9.9.9_x64.dmg'],
      ['macos', 'aarch64', 'installer', 'coolapk-desktop_9.9.9_aarch64.dmg'],
      ['linux', 'x86_64', 'portable', 'coolapk-desktop_9.9.9_amd64.AppImage'],
      ['linux', 'x86_64', 'deb', 'coolapk-desktop_9.9.9_amd64.deb'],
      ['linux', 'x86_64', 'rpm', 'coolapk-desktop-9.9.9-1.x86_64.rpm'],
    ] as const)('selects %s %s %s package', async (os, arch, packageType, name) => {
      const names = [
        'coolapk-desktop_9.9.9_x64.dmg', 'coolapk-desktop_9.9.9_aarch64.dmg',
        'coolapk-desktop_9.9.9_amd64.AppImage', 'coolapk-desktop_9.9.9_amd64.deb',
        'coolapk-desktop-9.9.9-1.x86_64.rpm', 'coolapk-desktop_9.9.9_arm64-setup.exe',
      ];
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true, json: async () => ({ tag_name: 'v9.9.9', assets: names.map((name) => ({
          name, browser_download_url: `https://github.com/download/${name}`,
        })) }),
      } as Response);
      const info = await checkLatestRelease('stable', { os, arch }, packageType);
      expect(info.installerName).toBe(name);
      expect(info.packageType).toBe(packageType);
    });

    it.each(['macos', 'linux'])('rejects older version assets on %s', async (os) => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true, json: async () => ({ tag_name: 'v9.9.9', assets: [
          { name: 'coolapk-desktop_9.9.8_x64.dmg', browser_download_url: 'old-macos' },
          { name: 'coolapk-desktop_9.9.8_amd64.AppImage', browser_download_url: 'old-linux' },
        ] }),
      } as Response);
      const info = await checkLatestRelease('stable', { os, arch: 'x86_64' }, os === 'linux' ? 'portable' : 'installer');
      expect(info.installerUrl).toBeUndefined();
    });
    it('fetches stable latest release and matches installer URL', async () => {
      const mockRelease = {
        tag_name: 'v9.9.9',
        body: '这是升级日志说明',
        html_url: 'https://github.com/SymonChu/coolapk-windows/releases/tag/v9.9.9',
        assets: [
          {
            name: 'coolapk-desktop_9.9.9_x64-setup.exe',
            browser_download_url: 'https://github.com/download/coolapk-desktop_9.9.9_x64-setup.exe',
          },
          {
            name: 'coolapk-desktop_9.9.9_arm64-setup.exe',
            browser_download_url: 'https://github.com/download/coolapk-desktop_9.9.9_arm64-setup.exe',
          },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockRelease,
      } as Response);

      const info = await checkLatestRelease('stable', { os: 'windows', arch: 'x86_64' });
      expect(info.hasNew).toBe(true);
      expect(info.latestVersion).toBe('v9.9.9');
      expect(info.installerUrl).toBe('https://github.com/download/coolapk-desktop_9.9.9_x64-setup.exe');
      expect(info.releaseNotes).toBe('这是升级日志说明');
    });

    it('does not select an installer from a different release version', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          tag_name: 'v2.0.0',
          assets: [
            {
              name: 'coolapk-desktop_1.9.0_x64-setup.exe',
              browser_download_url: 'https://github.com/download/old.exe',
            },
          ],
        }),
      } as Response);

      const info = await checkLatestRelease('stable', { os: 'windows', arch: 'x86_64' });
      expect(info.hasNew).toBe(true);
      expect(info.installerUrl).toBeUndefined();
    });

    it('matches the current architecture portable executable', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          tag_name: 'v9.9.9',
          assets: [
            {
              name: 'coolapk-desktop_9.9.9_x64-portable.exe',
              browser_download_url: 'https://github.com/download/x64-portable.exe',
            },
            {
              name: 'coolapk-desktop_9.9.9_arm64-portable.exe',
              browser_download_url: 'https://github.com/download/arm64-portable.exe',
            },
          ],
        }),
      } as Response);

      const info = await checkLatestRelease(
        'stable',
        { os: 'windows', arch: 'aarch64' },
        'portable'
      );
      expect(info.installerUrl).toBe('https://github.com/download/arm64-portable.exe');
      expect(info.packageType).toBe('portable');
    });

    it('returns remote release body as changelog when current version is latest and remote has body', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          tag_name: 'v1.9.1',
          body: '1.9.1 远程说明',
          published_at: '2026-08-21T11:51:14Z',
        }),
      } as Response);

      const info = await checkLatestRelease('stable', { os: 'windows', arch: 'x86_64' });
      expect(info.hasNew).toBe(false);
      expect(info.releaseNotes).toBe('1.9.1 远程说明');
      expect(info.publishedAt).toBeDefined();
    });

    it('returns builtin changelog when current version is latest and remote body is empty', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          tag_name: 'v1.10.0',
          body: '',
        }),
      } as Response);

      const info = await checkLatestRelease('stable', { os: 'windows', arch: 'x86_64' });
      expect(info.hasNew).toBe(false);
      expect(info.releaseNotes).toBe('暂无当前版本的更新日志。');
      expect(info.publishedAt).toBeUndefined();
    });
  });

  describe('selectInstallerAsset', () => {
    const assets = [
      { name: 'coolapk-desktop_9.9.9_x64-setup.exe', browser_download_url: 'x64-url' },
      { name: 'coolapk-desktop_9.9.9_arm64-setup.exe', browser_download_url: 'arm64-url' },
    ];

    it('selects the x64 installer on Windows x86_64', () => {
      expect(selectInstallerAsset(assets, { os: 'windows', arch: 'x86_64' })?.browser_download_url)
        .toBe('x64-url');
    });

    it('selects the arm64 installer on Windows aarch64', () => {
      expect(selectInstallerAsset(assets, { os: 'windows', arch: 'aarch64' })?.browser_download_url)
        .toBe('arm64-url');
    });
  });

  describe('selectPortableAsset', () => {
    const assets = [
      { name: 'coolapk-desktop_9.9.9_x64-portable.exe', browser_download_url: 'x64-url' },
      { name: 'coolapk-desktop_9.9.9_arm64-portable.exe', browser_download_url: 'arm64-url' },
      { name: 'coolapk-desktop_9.9.9_x64-setup.exe', browser_download_url: 'setup-url' },
    ];

    it('selects only the matching architecture portable executable', () => {
      expect(selectPortableAsset(assets, { os: 'windows', arch: 'x86_64' })?.browser_download_url)
        .toBe('x64-url');
      expect(selectPortableAsset(assets, { os: 'windows', arch: 'aarch64' })?.browser_download_url)
        .toBe('arm64-url');
    });
  });
});
