import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseReleaseVersion } from './release-version.mjs';

export function createBetaTag(tag, sourceSha, run = execFileSync) {
  if (!tag?.startsWith('v') || parseReleaseVersion(tag.slice(1)).beta === null) throw new Error('必须指定完整测试标签');
  if (!/^[a-f0-9]{40}$/.test(sourceSha || '')) throw new Error('必须指定本次完整源码 SHA');
  const git = (args) => run('git', args, { encoding: 'utf8' }).trim();
  if (git(['rev-parse', 'HEAD']) !== sourceSha) throw new Error('checkout 与本次源码 SHA 不一致');
  if (git(['tag', '--list', tag])) throw new Error(`本地标签 ${tag} 已存在`);
  if (git(['ls-remote', '--tags', 'origin', `refs/tags/${tag}`, `refs/tags/${tag}^{}`])) {
    throw new Error(`远端标签 ${tag} 已存在`);
  }
  git(['config', 'user.name', 'github-actions[bot]']);
  git(['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);
  git(['tag', '-a', tag, sourceSha, '-m', `测试版本 ${tag}，源码 ${sourceSha}`]);
  git(['push', 'origin', `refs/tags/${tag}`]);
  const remote = git(['ls-remote', '--exit-code', '--tags', 'origin', `refs/tags/${tag}^{}`]);
  if (remote.split(/\s+/)[0] !== sourceSha) throw new Error('远端测试标签未指向本次源码提交');
  return sourceSha;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(`测试标签指向源码 ${createBetaTag(process.env.BETA_TAG, process.env.SOURCE_SHA)}`);
}
