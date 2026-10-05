import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseReleaseVersion } from './release-version.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const versionFile = path.join(root, 'src/constants/version.ts');
const currentVersionText = fs.readFileSync(versionFile, 'utf8');
const requestedVersion = (process.argv[2] || '').replace(/^v/i, '');
const version = requestedVersion || currentVersionText.match(/APP_VERSION\s*=\s*'([^']+)'/)?.[1];

let parsed;
try {
  parsed = parseReleaseVersion(version || '');
  if (requestedVersion && parsed.beta !== null && !process.argv.includes('--beta')) {
    throw new Error('同步测试版本必须显式传入 --beta');
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const update = (relativePath, transform) => {
  const filePath = path.join(root, relativePath);
  fs.writeFileSync(filePath, transform(fs.readFileSync(filePath, 'utf8')));
};

function updateVersionSource(nextVersion) {
  update('src/constants/version.ts', (text) => text.replace(/(APP_VERSION\s*=\s*')[^']+(')/, `$1${nextVersion}$2`));
}

if (requestedVersion) {
  updateVersionSource(version);
}

update('package.json', (text) => text.replace(/("version"\s*:\s*")[^"]+(")/, `$1${version}$2`));
update('package-lock.json', (text) => {
  try {
    const lock = JSON.parse(text);
    lock.version = version;
    if (lock.packages && lock.packages['']) {
      lock.packages[''].version = version;
    }
    return JSON.stringify(lock, null, 2) + '\n';
  } catch (e) {
    return text;
  }
});
update('src-tauri/tauri.conf.json', (text) => {
  const config = JSON.parse(text);
  config.version = version;
  config.bundle.android = { ...config.bundle.android, versionCode: parsed.code };
  const stage = parsed.beta ?? 999;
  // Apple build versions use three numeric components; reserve the final stage above every beta.
  const appleBuild = `${parsed.major * 100 + parsed.minor}.${parsed.patch * 10 + Math.floor(stage / 100)}.${stage % 100}`;
  config.bundle.iOS = { ...config.bundle.iOS, bundleVersion: appleBuild };
  config.bundle.macOS = { ...config.bundle.macOS, bundleVersion: appleBuild };
  return JSON.stringify(config, null, 2) + '\n';
});
update('src-tauri/Cargo.toml', (text) => text.replace(/(^version\s*=\s*")[^"]+(")/m, `$1${version}$2`));
update('src-tauri/Cargo.lock', (text) => text.replace(/(name = "coolapk_desktop"\r?\nversion = ")[^"]+(")/, `$1${version}$2`));

console.log(`版本已同步为 ${version}`);
