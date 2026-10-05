import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { allocateBetaVersion, parseReleaseVersion, resolveBetaTarget } from './release-version.mjs';
import { readReleaseTags } from './release-tags.mjs';
import { pruneBetaReleases } from './prune-beta-releases.mjs';
import { createBetaTag } from './create-beta-tag.mjs';

test('测试标签直接指向原源码，不提交临时 beta 版本，也不改动 main', () => {
  const dir = mkdtempSync(join(tmpdir(), 'coolapk-beta-tag-'));
  const repository = join(dir, 'checkout');
  const remote = join(dir, 'remote.git');
  mkdirSync(repository);
  const run = (command, args, options) => {
    const result = spawnSync(command, args, { ...options, cwd: repository });
    if (result.status !== 0) throw new Error(result.stderr);
    return result.stdout;
  };
  const git = (...args) => run('git', args, { encoding: 'utf8' }).trim();
  try {
    git('init');
    git('checkout', '-b', 'main');
    git('config', 'user.name', 'Beta test');
    git('config', 'user.email', 'beta@example.invalid');
    git('config', 'commit.gpgsign', 'false');
    git('config', 'tag.gpgsign', 'false');
    writeFileSync(join(repository, 'package.json'), '{"version":"1.30.0"}\n');
    git('add', 'package.json');
    git('commit', '-m', '源码提交');
    const sourceSha = git('rev-parse', 'HEAD');
    git('init', '--bare', remote);
    git('remote', 'add', 'origin', remote);
    git('push', 'origin', 'main');
    writeFileSync(join(repository, 'package.json'), '{"version":"1.31.0-beta.1"}\n');
    assert.equal(createBetaTag('v1.31.0-beta.1', sourceSha, run), sourceSha);
    assert.equal(git('rev-parse', 'HEAD'), sourceSha);
    assert.equal(git('rev-list', '--count', 'HEAD'), '1');
    assert.equal(git('rev-parse', 'v1.31.0-beta.1^{}'), sourceSha);
    assert.equal(git('cat-file', '-t', 'v1.31.0-beta.1'), 'tag');
    assert.equal(JSON.parse(git('show', 'v1.31.0-beta.1:package.json')).version, '1.30.0');
    assert.equal(JSON.parse(readFileSync(join(repository, 'package.json'))).version, '1.31.0-beta.1');
    assert.ok(git('ls-remote', 'origin', 'refs/heads/main').startsWith(sourceSha));
    assert.throws(() => createBetaTag('v1.31.0-beta.1', sourceSha, run), /已存在/);
    assert.throws(() => createBetaTag('v1.31.0-beta.2', '0'.repeat(40), run), /不一致/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('远端已有测试标签或查询失败时停止，不覆盖标签', () => {
  const sha = 'a'.repeat(40);
  for (const offline of [false, true]) {
    assert.throws(() => createBetaTag('v1.31.0-beta.1', sha, (_, args) => {
      if (args[0] === 'rev-parse') return sha;
      if (args[0] === 'tag' && args[1] === '--list') return '';
      assert.equal(args[0], 'ls-remote');
      if (offline) throw new Error('offline');
      return `${sha}\trefs/tags/v1.31.0-beta.1`;
    }), offline ? /offline/ : /已存在/);
  }
});

test('新测试版公开完整后仅删除更旧的 beta Release，保留正式版和所有标签', () => {
  const releases = [
    { tag_name: 'v1.31.0-beta.2', prerelease: true },
    { tag_name: 'v1.30.1-beta.9', prerelease: true },
    { tag_name: 'v1.31.0-beta.1', prerelease: true },
    { tag_name: 'v1.31.0-beta.3', prerelease: true },
    { tag_name: 'v1.30.0', prerelease: false },
    { tag_name: 'v1.29.0', prerelease: true },
    { tag_name: 'v1.31.0-rc.1', prerelease: true },
    { tag_name: 'v1.30.1-beta.1', prerelease: true, draft: true },
  ];
  const deleted = [];
  const removed = pruneBetaReleases('example/desktop', 'v1.31.0-beta.2', (command, args) => {
    assert.equal(command, 'gh');
    if (args[1] === 'view') return JSON.stringify({ tagName: 'v1.31.0-beta.2', isDraft: false, isPrerelease: true, assetCount: 13 });
    if (args[0] === 'api') {
      assert.ok(args.includes('--paginate'));
      return releases.map((release) => JSON.stringify(release)).join('\n');
    }
    assert.equal(args[1], 'delete');
    assert.ok(!args.includes('--cleanup-tag'));
    deleted.push(args[2]);
    return '';
  });
  assert.deepEqual(removed, ['v1.30.1-beta.9', 'v1.31.0-beta.1']);
  assert.deepEqual(deleted, removed);
  assert.equal(allocateBetaVersion('1.31.0', '1.30.0', releases.map((release) => release.tag_name)), '1.31.0-beta.4');
});

test('草稿、未完整上传、正式版和查询失败均不触发测试版清理', () => {
  for (const state of [
    { isDraft: true, isPrerelease: true, assetCount: 13 },
    { isDraft: false, isPrerelease: true, assetCount: 11 },
    { isDraft: false, isPrerelease: false, assetCount: 13 },
  ]) {
    let queries = 0;
    assert.throws(() => pruneBetaReleases('example/desktop', 'v1.31.0-beta.2', (_, args) => {
      queries++;
      assert.equal(args[1], 'view');
      return JSON.stringify({ tagName: 'v1.31.0-beta.2', ...state });
    }));
    assert.equal(queries, 1);
  }
  assert.throws(() => pruneBetaReleases('example/desktop', 'v1.31.0-beta.2', () => { throw new Error('offline'); }));
  assert.throws(() => pruneBetaReleases('example/desktop', 'v1.31.0'));
});

test('Release 查询在 gh 内提取标签，避免完整发布信息撑满子进程缓冲区', () => {
  const tags = readReleaseTags('example/desktop', (command, args, options) => {
    assert.equal(command, 'gh');
    assert.ok(args.includes('--paginate'));
    assert.equal(args[args.indexOf('--jq') + 1], '.[].tag_name');
    assert.equal(options.encoding, 'utf8');
    return 'v1.31.0-beta.9\nv1.31.0-beta.101\r\nv1.30.0\n';
  });
  assert.equal(allocateBetaVersion('1.31.0', '1.30.0', tags), '1.31.0-beta.102');
});

test('beta 编号检查所有标签，并拒绝回退或正式版已发布的目标', () => {
  assert.equal(allocateBetaVersion('1.31.0', '1.30.0', ['v1.31.0-beta.9', 'v1.31.0-beta.101']), '1.31.0-beta.102');
  for (const tags of [['v1.31.0'], ['v1.32.0-beta.1']]) {
    assert.throws(() => allocateBetaVersion('1.31.0', '1.30.0', tags));
  }
  assert.throws(() => allocateBetaVersion('1.30.0', '1.30.0', []));
  assert.throws(() => allocateBetaVersion('1.31.0', '1.30.0', ['v1.31.0-beta.998']));
  assert.throws(() => parseReleaseVersion('1.31.0-beta.01'));
});

test('Android 编码支持正式版到多次 beta 再到正式版', () => {
  const versions = ['1.30.0', '1.31.0-beta.1', '1.31.0-beta.101', '1.31.0-beta.998', '1.31.0', '1.31.1-beta.1'];
  const codes = versions.map((version) => parseReleaseVersion(version).code);
  assert.ok(codes.every((code, index) => index === 0 || code > codes[index - 1]));
});

test('版本增量基于正式版计算，次版本递增清零补丁，连续构建只递增 beta', () => {
  assert.equal(resolveBetaTarget('1.30.0', [], '+0.0.1'), '1.30.1');
  assert.equal(resolveBetaTarget('1.30.7', [], '+0.1'), '1.31.0');
  assert.equal(resolveBetaTarget('1.30.0', ['v1.30.2', 'v1.31.0-beta.9'], '+0.0.1'), '1.30.3');
  const tags = ['v1.30.1-beta.1', 'v1.30.1-beta.2'];
  const target = resolveBetaTarget('1.30.0', tags, '+0.0.1');
  assert.equal(target, '1.30.1');
  assert.equal(allocateBetaVersion(target, '1.30.0', tags), '1.30.1-beta.3');
  assert.equal(resolveBetaTarget('1.30.2', ['v1.30.0'], '+0.0.1'), '1.30.3');
});

test('手动目标覆盖自动计算，并拒绝遗漏或错误的输入', () => {
  assert.equal(resolveBetaTarget('1.30.0', [], '+0.0.1', ' 1.32.0 '), '1.32.0');
  assert.equal(resolveBetaTarget('1.30.0', [], '手动填写', '1.31.0'), '1.31.0');
  assert.throws(() => resolveBetaTarget('1.30.0', [], '手动填写'));
  assert.throws(() => resolveBetaTarget('1.30.0', [], '+0.1', '1.31.0-beta.1'));
  assert.throws(() => resolveBetaTarget('1.30.0', [], '+0.2'));
});

test('版本脚本在隔离目录同步六个文件，并保持无参数 beta 构建', () => {
  const root = mkdtempSync(join(tmpdir(), 'coolapk-beta-version-'));
  const files = ['scripts/set-version.mjs', 'scripts/release-version.mjs', 'package.json', 'package-lock.json',
    'src/constants/version.ts', 'src-tauri/tauri.conf.json', 'src-tauri/Cargo.toml', 'src-tauri/Cargo.lock'];
  try {
    for (const file of files) {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      copyFileSync(resolve(file), join(root, file));
    }
    const run = (args) => spawnSync(process.execPath, ['scripts/set-version.mjs', ...args], { cwd: root, encoding: 'utf8' });
    assert.notEqual(run(['1.31.0-beta.101']).status, 0);
    assert.equal(run(['1.31.0-beta.101', '--beta']).status, 0);
    assert.equal(run([]).status, 0);
    for (const file of files.slice(2)) assert.ok(readFileSync(join(root, file), 'utf8').includes('1.31.0-beta.101'), file);
    const config = JSON.parse(readFileSync(join(root, 'src-tauri/tauri.conf.json')));
    assert.equal(config.bundle.android.versionCode, parseReleaseVersion('1.31.0-beta.101').code);
    assert.equal(config.bundle.iOS.bundleVersion, '131.1.1');
    assert.equal(config.bundle.macOS.bundleVersion, '131.1.1');
    assert.equal(run(['1.31.0']).status, 0);
    assert.equal(JSON.parse(readFileSync(join(root, 'src-tauri/tauri.conf.json'))).bundle.android.versionCode, parseReleaseVersion('1.31.0').code);
    assert.equal(JSON.parse(readFileSync(join(root, 'src-tauri/tauri.conf.json'))).bundle.iOS.bundleVersion, '131.9.99');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('产物收集需要全部十二个平台包，缺失或重复时失败', () => {
  const root = mkdtempSync(join(tmpdir(), 'coolapk-beta-assets-'));
  const version = '1.31.0-beta.101';
  const names = [
    ...['x64-setup.exe', 'arm64-setup.exe', 'x64-portable.exe', 'arm64-portable.exe', 'x64.dmg', 'aarch64.dmg', 'amd64.AppImage', 'amd64.deb'].map((suffix) => `coolapk-desktop_${version}_${suffix}`),
    `coolapk-desktop-${version}-1.x86_64.rpm`,
    ...['android-arm64.apk', 'android-arm64.aab', 'ios-arm64-unsigned.ipa'].map((suffix) => `coolapk-v${version}-${suffix}`),
  ];
  const run = () => spawnSync(process.execPath, [resolve('scripts/collect-beta-assets.mjs')], {
    cwd: root, encoding: 'utf8', env: { ...process.env, BETA_VERSION: version },
  });
  try {
    mkdirSync(join(root, 'beta-artifacts'));
    for (const name of names.slice(1)) writeFileSync(join(root, 'beta-artifacts', name), 'fixture');
    assert.notEqual(run().status, 0);
    writeFileSync(join(root, 'beta-artifacts', names[0]), 'fixture');
    const result = run();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(join(root, 'beta-release/SHA256SUMS'), 'utf8').trim().split('\n').length, 12);
    mkdirSync(join(root, 'beta-artifacts/duplicate'));
    writeFileSync(join(root, 'beta-artifacts/duplicate', names[0]), 'fixture');
    assert.notEqual(run().status, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
