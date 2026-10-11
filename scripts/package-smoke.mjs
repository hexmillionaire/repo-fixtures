import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const execute = promisify(execFile);
const source = fileURLToPath(new URL('../', import.meta.url));
const temp = await mkdtemp(path.join(os.tmpdir(), 'repo-fixtures-package-'));
const npm = process.env.npm_execpath;
if (!npm) throw new Error('Run through npm run test:package.');
const run = (args, cwd = source) => execute(process.execPath, args, { cwd, windowsHide: true, timeout: 60000, maxBuffer: 4 * 1024 * 1024, encoding: 'utf8' });
try {
  const manifest = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8'));
  const packed = JSON.parse((await run([npm, 'pack', '--json', '--pack-destination', temp])).stdout)[0];
  assert.equal(packed.version, manifest.version);
  for (const file of packed.files) assert.ok(!/^(node_modules|test|\.git|\.agent-lanes)\//.test(file.path), file.path);
  const install = path.join(temp, 'install'); await mkdir(install);
  await run([npm, 'install', '--prefix', install, '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund', path.join(temp, packed.filename)]);
  const bin = path.join(install, 'node_modules', ...manifest.name.split('/'), 'bin/repo-fixtures.mjs');
  const created = JSON.parse((await run([bin, 'create', 'staged', path.join(temp, 'fixture'), '--json'])).stdout);
  assert.deepEqual(created.manifest.observations.status, [{ index: 'M', worktree: 'M', path: 'src/app.txt' }]);
  console.log('Fresh production archive installation and real staged CLI fixture passed.');
} finally {
  assert.equal(path.dirname(temp), path.resolve(os.tmpdir())); assert.ok(path.basename(temp).startsWith('repo-fixtures-package-'));
  await rm(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
