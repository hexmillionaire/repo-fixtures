import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { createFixture } from '../src/index.mjs';

test('linked fixture uses real shared Git administration and isolated worktree/index state', async t => {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'repo-fixtures-linked-'));
  t.after(async () => {
    assert.equal(path.dirname(parent), path.resolve(os.tmpdir()));
    assert.ok(path.basename(parent).startsWith('repo-fixtures-linked-'));
    await rm(parent, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  const result = await createFixture('linked-worktree', path.join(parent, 'linked bundle'));
  const primary = path.join(result.directory, 'upstream');
  const git = (root, args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', windowsHide: true });
  assert.match(await readFile(path.join(result.repository, '.git'), 'utf8'), /^gitdir: /);
  assert.equal(git(result.repository, ['rev-parse', '--is-inside-work-tree']).trim(), 'true');
  assert.equal(git(result.repository, ['rev-parse', 'HEAD']).trim(), git(primary, ['rev-parse', 'HEAD']).trim());
  assert.equal(git(result.repository, ['branch', '--show-current']).trim(), 'fixture/worktree');
  assert.equal(git(primary, ['branch', '--show-current']).trim(), 'main');
  assert.equal((git(primary, ['worktree', 'list', '--porcelain']).match(/^worktree /gm) ?? []).length, 2);
  assert.deepEqual(result.manifest.layout, { kind: 'linked-worktree', primaryRepository: 'upstream', branch: 'fixture/worktree' });
  await writeFile(path.join(result.repository, 'src/app.txt'), 'linked worktree edit\n');
  git(result.repository, ['add', '--', 'src/app.txt']);
  assert.equal(git(result.repository, ['show', ':src/app.txt']), 'linked worktree edit\n');
  assert.equal(git(primary, ['show', ':src/app.txt']), 'baseline\n');
  assert.equal(await readFile(path.join(primary, 'src/app.txt'), 'utf8'), 'baseline\n');
  assert.equal(git(primary, ['status', '--porcelain']), '');
});
