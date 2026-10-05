import { appendFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { allocateBetaVersion, resolveBetaTarget } from './release-version.mjs';
import { readReleaseTags } from './release-tags.mjs';

const current = JSON.parse(readFileSync('package.json', 'utf8')).version;
const releaseTags = readReleaseTags(process.env.GITHUB_REPOSITORY);
const refs = execFileSync('git', ['ls-remote', '--tags', 'origin'], { encoding: 'utf8' });
const versions = [...releaseTags,
  ...[...refs.matchAll(/refs\/tags\/v([^\s^]+)/g)].map((match) => `v${match[1]}`)];
const target = resolveBetaTarget(current, versions, process.env.VERSION_INCREMENT || '+0.0.1', process.env.TARGET_VERSION || '');
const version = allocateBetaVersion(target, current, versions);
appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\ntag=v${version}\nsha=${process.env.GITHUB_SHA}\n`);
console.log(`测试版本 v${version}，源码 ${process.env.GITHUB_SHA}`);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `目标正式版本：${target}\n\n测试版本：v${version}\n\n源码提交：${process.env.GITHUB_SHA}\n`);
}
