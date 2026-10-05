import { mkdirSync, readdirSync, copyFileSync, writeFileSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { parseReleaseVersion } from './release-version.mjs';

const version = process.env.BETA_VERSION;
parseReleaseVersion(version);
function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}
const files = walk('beta-artifacts').filter((path) => /\.(exe|dmg|deb|rpm|AppImage|apk|aab|ipa)$/i.test(path));
const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const desktop = `coolapk-desktop[_-]${escaped}`;
const required = [
  `${desktop}_(?:x64|amd64)-setup\\.exe`, `${desktop}_(?:arm64|aarch64)-setup\\.exe`,
  `${desktop}_x64-portable\\.exe`, `${desktop}_arm64-portable\\.exe`,
  `${desktop}_(?:x64|x86_64)\\.dmg`, `${desktop}_(?:aarch64|arm64)\\.dmg`,
  `${desktop}_(?:amd64|x86_64)\\.AppImage`, `${desktop}_(?:amd64|x86_64)\\.deb`,
  `${desktop}-\\d+\\.x86_64\\.rpm`,
  `coolapk-v${escaped}-android-arm64\\.apk`, `coolapk-v${escaped}-android-arm64\\.aab`,
  `coolapk-v${escaped}-ios-arm64-unsigned\\.ipa`,
];
mkdirSync('beta-release', { recursive: true });
const checksums = [];
for (const pattern of required) {
  const matches = files.filter((path) => new RegExp(`^${pattern}$`, 'i').test(basename(path)));
  if (matches.length !== 1) throw new Error(`更新包缺失或重复：${pattern}（${matches.length}）`);
  const name = basename(matches[0]);
  copyFileSync(matches[0], join('beta-release', name));
  checksums.push(`${createHash('sha256').update(readFileSync(matches[0])).digest('hex')}  ${name}`);
}
writeFileSync('beta-release/SHA256SUMS', checksums.join('\n') + '\n');
writeFileSync('beta-notes.md', `测试版本 v${version}\n\n源码提交：${process.env.SOURCE_SHA}\n\n构建记录：https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}\n\n开启「实验性功能」，将更新渠道切换为「测试版」即可接收更新。\n\niOS 提供未签名 IPA，需要自行签名安装。\n`);
console.log(`全平台 ${required.length} 个更新包校验通过`);
