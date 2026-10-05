import { execFileSync } from 'node:child_process';

export function readReleaseTags(repository, run = execFileSync) {
  // Release bodies and assets can exceed Node's subprocess buffer. Filter inside
  // gh, before stdout is captured, and keep pagination for historical beta tags.
  return run('gh', ['api', '--paginate', '--jq', '.[].tag_name',
    `repos/${repository}/releases?per_page=100`], { encoding: 'utf8' })
    .split(/\r?\n/).map((tag) => tag.trim()).filter(Boolean);
}
