import { existsSync, lstatSync, readdirSync, rmdirSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptsDir, '..');
const distDir = resolve(repoRoot, 'dist');

if (dirname(distDir) !== repoRoot || !distDir.endsWith('dist')) {
  throw new Error(`拒绝清理非预期目录: ${distDir}`);
}

function removeTree(target) {
  if (!existsSync(target)) return;
  const stat = lstatSync(target);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    unlinkSync(target);
    return;
  }
  for (const entry of readdirSync(target)) {
    removeTree(resolve(target, entry));
  }
  rmdirSync(target);
}

removeTree(distDir);
