import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile, access, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createFixture, listScenarios } from '../src/index.mjs';

async function parent(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'repo-fixtures-test-'));
  t.after(async () => { assert.equal(path.dirname(root), path.resolve(os.tmpdir())); assert.ok(path.basename(root).startsWith('repo-fixtures-test-')); await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });
  return root;
}
for (const { id } of listScenarios()) test(`${id}: real Git state matches independently specified expected facts`, async t => {
  const root = await parent(t); const result = await createFixture(id, path.join(root, 'fixture with spaces'));
  const { observations, expectations } = result.manifest;
  assert.deepEqual(observations.status, expectations.status); assert.deepEqual(observations.conflicts, expectations.conflicts); assert.deepEqual(observations.submodules, expectations.submodules);
  assert.equal(observations.branch, 'main'); assert.match(result.manifest.base, /^[a-f0-9]{40}$/);
  assert.deepEqual(JSON.parse(await readFile(path.join(result.directory, 'fixture.json'), 'utf8')), result.manifest);
  await assert.rejects(access(path.join(result.directory, 'INCOMPLETE.txt')));
  if (id === 'staged') {
    const index = execFileSync('git', ['-C', result.repository, 'show', ':src/app.txt'], { encoding: 'utf8', windowsHide: true });
    assert.equal(index, 'staged change\n'); assert.equal(await readFile(path.join(result.repository, 'src/app.txt'), 'utf8'), 'unstaged change after staging\n');
  }
  if (id === 'conflict') assert.match(await readFile(path.join(result.repository, 'src/app.txt'), 'utf8'), /<<<<<<< HEAD/);
  if (id === 'dirty') await access(path.join(result.repository, 'ignored/cache.txt'));
});
test('rejects existing destinations and invalid scenarios without changing existing data', async t => {
  const root = await parent(t); const destination = path.join(root, 'existing'); await mkdir(destination); await writeFile(path.join(destination, 'keep.txt'), 'keep');
  await assert.rejects(createFixture('clean', destination), /already exists/); assert.equal(await readFile(path.join(destination, 'keep.txt'), 'utf8'), 'keep');
  await assert.rejects(createFixture('invalid', path.join(root, 'invalid')), /Unknown scenario/); await assert.rejects(access(path.join(root, 'invalid')));
});
test('pre-aborted creation leaves no directory and competing creators never overwrite', async t => {
  const root = await parent(t); const destination = path.join(root, 'race');
  await assert.rejects(createFixture('clean', destination, { signal: AbortSignal.abort() })); await assert.rejects(access(destination));
  const results = await Promise.allSettled([createFixture('clean', destination), createFixture('dirty', destination)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1); assert.equal(results.filter(result => result.status === 'rejected').length, 1);
});
test('CLI JSON workflow and usage errors', async t => {
  const root = await parent(t); const bin = fileURLToPath(new URL('../bin/repo-fixtures.mjs', import.meta.url));
  const listing = spawnSync(process.execPath, [bin, 'list', '--json'], { encoding: 'utf8', windowsHide: true }); assert.equal(listing.status, 0); assert.equal(JSON.parse(listing.stdout).scenarios.length, 7);
  const created = spawnSync(process.execPath, [bin, 'create', 'dirty', path.join(root, 'cli'), '--json'], { encoding: 'utf8', windowsHide: true }); assert.equal(created.status, 0, created.stderr); assert.equal(JSON.parse(created.stdout).manifest.scenario, 'dirty');
  const invalid = spawnSync(process.execPath, [bin, 'create', 'dirty'], { encoding: 'utf8', windowsHide: true }); assert.equal(invalid.status, 2);
});
test('hostile inherited Git environment and global hooks do not affect fixture setup', async t => {
  const root = await parent(t); const bin = fileURLToPath(new URL('../bin/repo-fixtures.mjs', import.meta.url));
  const hostile = path.join(root, 'hostile'); await mkdir(hostile); await writeFile(path.join(hostile, 'keep.txt'), 'keep');
  const created = spawnSync(process.execPath, [bin, 'create', 'clean', path.join(root, 'isolated'), '--json'], { encoding: 'utf8', windowsHide: true,
    env: { ...process.env, GIT_DIR: hostile, GIT_WORK_TREE: hostile, GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'core.hooksPath', GIT_CONFIG_VALUE_0: hostile } });
  assert.equal(created.status, 0, created.stderr); assert.equal(await readFile(path.join(hostile, 'keep.txt'), 'utf8'), 'keep');
  assert.deepEqual(JSON.parse(created.stdout).manifest.observations.status, []);
});
test('default XDG attributes and ignore files cannot change generated facts', async t => {
  const root = await parent(t); const bin = fileURLToPath(new URL('../bin/repo-fixtures.mjs', import.meta.url));
  const config = path.join(root, 'hostile-config'); await mkdir(path.join(config, 'git'), { recursive: true });
  await writeFile(path.join(config, 'git', 'ignore'), 'new file.txt\n');
  await writeFile(path.join(config, 'git', 'attributes'), '*.txt working-tree-encoding=UTF-16\n');
  const created = spawnSync(process.execPath, [bin, 'create', 'dirty', path.join(root, 'isolated-xdg'), '--json'], { encoding: 'utf8', windowsHide: true, env: { ...process.env, XDG_CONFIG_HOME: config } });
  assert.equal(created.status, 0, created.stderr);
  const report = JSON.parse(created.stdout).manifest;
  assert.deepEqual(report.observations.status, report.expectations.status);
  assert.equal(report.observations.status.length, 2);
});

test('a failed final marker write retains an incomplete bundle and never marks it created', async t => {
  const root = await parent(t);
  const destination = path.join(root, 'completion-write-failure');
  const source = new URL('../src/index.mjs', import.meta.url).href;
  // Isolate the filesystem fault in a child: all repository creation and Git work
  // remain real, while only rewriting a completion marker simulates a full disk.
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import fs from 'node:fs';
    import path from 'node:path';
    import { syncBuiltinESMExports } from 'node:module';
    const originalWrite = fs.promises.writeFile;
    let failures = 0;
    fs.promises.writeFile = async (file, contents, options) => {
      if (['INCOMPLETE.txt', 'CREATED.txt'].includes(path.basename(file)) && options?.flag !== 'wx') {
        failures++;
        throw Object.assign(new Error('Injected completion write failure'), { code: 'ENOSPC' });
      }
      return originalWrite(file, contents, options);
    };
    syncBuiltinESMExports();
    const { createFixture } = await import(process.argv[1]);
    await assert.rejects(createFixture('staged', process.argv[2]), { code: 'ENOSPC' });
    assert.equal(failures, 1);
  `, source, destination], { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  assert.equal(child.status, 0, child.stderr || child.error?.message);
  assert.match(await readFile(path.join(destination, 'INCOMPLETE.txt'), 'utf8'), /creation did not finish/);
  await assert.rejects(access(path.join(destination, 'CREATED.txt')), { code: 'ENOENT' });
  const manifest = JSON.parse(await readFile(path.join(destination, 'fixture.json'), 'utf8'));
  assert.equal(manifest.scenario, 'staged');
  assert.deepEqual(manifest.observations.status, [{ index: 'M', worktree: 'M', path: 'src/app.txt' }]);
  assert.equal(execFileSync('git', ['-C', path.join(destination, 'repo'), 'show', ':src/app.txt'], { encoding: 'utf8', windowsHide: true }), 'staged change\n');
});

test('committed history does not depend on the destination path', async t => {
  const root = await parent(t);
  await mkdir(path.join(root, 'one')); await mkdir(path.join(root, 'two', 'deeper path'), { recursive: true });
  for (const { id } of listScenarios()) {
    const first = await createFixture(id, path.join(root, 'one', id));
    const second = await createFixture(id, path.join(root, 'two', 'deeper path', id));
    assert.equal(first.manifest.observations.head, second.manifest.observations.head, id);
  }
  const gitmodules = await readFile(path.join(root, 'one', 'submodule', 'repo', '.gitmodules'), 'utf8');
  assert.match(gitmodules, /url = \.\.\/upstream/); assert.ok(!gitmodules.includes(root));
  const status = execFileSync('git', ['-C', path.join(root, 'two', 'deeper path', 'submodule', 'repo'), 'submodule', 'status'], { encoding: 'utf8', windowsHide: true });
  assert.match(status, /^ [a-f0-9]{40} modules\/child/);
});
test('a missing parent directory is reported plainly and nothing is created', async t => {
  const root = await parent(t);
  await assert.rejects(createFixture('clean', path.join(root, 'missing', 'fixture')), /parent directory must already exist/);
  await assert.rejects(access(path.join(root, 'missing')));
});
