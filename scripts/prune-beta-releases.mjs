import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseReleaseVersion } from './release-version.mjs';

// Only delete older public beta Releases. Tags remain as the numbering history.
export function pruneBetaReleases(repository, keepTag, run = execFileSync) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '')) throw new Error('缺少有效仓库名称');
  if (!keepTag?.startsWith('v')) throw new Error('必须指定完整测试标签');
  const keep = parseReleaseVersion(keepTag.slice(1));
  if (keep.beta === null) throw new Error('只允许清理测试版本');
  const options = { encoding: 'utf8' };
  const published = JSON.parse(run('gh', ['release', 'view', keepTag, '--repo', repository,
    '--json', 'tagName,isDraft,isPrerelease,assets', '--jq',
    '{tagName,isDraft,isPrerelease,assetCount:(.assets|length)}'], options));
  if (published.tagName !== keepTag || published.isDraft || !published.isPrerelease || published.assetCount < 12) {
    throw new Error('新测试版本尚未完整公开，保留旧测试版本');
  }
  const lines = run('gh', ['api', `repos/${repository}/releases?per_page=100`, '--paginate', '--jq',
    '.[] | {tag_name,draft,prerelease}'], options);
  const removed = [];
  for (const line of lines.split(/\r?\n/).filter(Boolean)) {
    const release = JSON.parse(line);
    if (release.draft || !release.prerelease || release.tag_name === keepTag || !release.tag_name?.startsWith('v')) continue;
    let version;
    try { version = parseReleaseVersion(release.tag_name.slice(1)); } catch { continue; }
    if (version.beta === null || version.code >= keep.code) continue;
    run('gh', ['release', 'delete', release.tag_name, '--repo', repository, '--yes'], options);
    removed.push(release.tag_name);
  }
  return removed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const removed = pruneBetaReleases(process.env.GITHUB_REPOSITORY, process.env.BETA_TAG);
  console.log(`保留 ${process.env.BETA_TAG}；已清理旧测试 Release：${removed.join('、') || '无'}。历史标签保留。`);
}
