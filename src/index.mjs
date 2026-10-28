import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, rename, realpath } from 'node:fs/promises';
import path from 'node:path';

export const VERSION = '0.2.0';
const execute = promisify(execFile);
const catalogue = [
  ['clean', 'One committed file and a clean worktree.'],
  ['dirty', 'Unstaged modification, untracked file, and an ignored file.'],
  ['staged', 'A staged version and a different unstaged version of the same file.'],
  ['rename', 'A staged rename with a space in the destination name.'],
  ['conflict', 'Two branches edit the same line; a real unresolved merge.'],
  ['unusual-paths', 'Unicode and space-containing tracked and untracked paths.'],
  ['submodule', 'A locally created Git submodule, without network access.'],
  ['linked-worktree', 'A clean linked Git worktree with a .git file and sibling primary repository.'],
];
export function listScenarios() { return catalogue.map(([id, description]) => ({ id, description })); }

async function git(bundle, repository, args, { signal, expected = 0 } = {}) {
  signal?.throwIfAborted();
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key)));
  Object.assign(env, { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(bundle, 'empty.gitconfig'), GIT_ATTR_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0',
    GIT_AUTHOR_NAME: 'Repo Fixtures', GIT_AUTHOR_EMAIL: 'fixtures@example.invalid', GIT_COMMITTER_NAME: 'Repo Fixtures', GIT_COMMITTER_EMAIL: 'fixtures@example.invalid',
    GIT_AUTHOR_DATE: '2020-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2020-01-01T00:00:00Z', GIT_DEFAULT_HASH: 'sha1', GIT_DEFAULT_REF_FORMAT: 'files' });
  const command = ['-c', 'core.autocrlf=false', '-c', 'core.attributesFile=' + path.join(bundle, 'empty.gitconfig'), '-c', 'core.excludesFile=' + path.join(bundle, 'empty.gitconfig'), '-c', 'core.hooksPath=' + path.join(bundle, 'empty-hooks'), '-c', 'core.fsmonitor=false', '-c', 'commit.gpgSign=false', '-C', repository, ...args];
  try {
    const result = await execute('git', command, { env, signal, windowsHide: true, timeout: 15000, maxBuffer: 4 * 1024 * 1024, encoding: 'utf8' });
    if (expected !== 0) throw new Error(`Expected Git exit ${expected}; received 0.`);
    return result.stdout;
  } catch (error) {
    signal?.throwIfAborted();
    if (Number.isInteger(error.code) && error.code === expected) return error.stdout;
    if (error.code === 'ENOENT') throw new Error('Git is required on PATH.');
    throw new Error(`Git ${args[0]} failed: ${String(error.stderr || error.message).trim().slice(0, 500)}`);
  }
}

async function file(repository, name, contents) {
  await mkdir(path.dirname(path.join(repository, name)), { recursive: true });
  await writeFile(path.join(repository, name), contents, { flag: 'wx' });
}
async function init(bundle, repository, signal) {
  await mkdir(repository);
  await git(bundle, repository, ['init', '-q', '--initial-branch=main', '--object-format=sha1'], { signal });
  // Persist the safe defaults so the generated repo remains useful for manual exploration.
  for (const [key, value] of [['core.autocrlf', 'false'], ['core.quotePath', 'false'], ['core.attributesFile', path.join(bundle, 'empty.gitconfig')], ['core.excludesFile', path.join(bundle, 'empty.gitconfig')], ['core.hooksPath', path.join(bundle, 'empty-hooks')], ['commit.gpgSign', 'false'], ['user.name', 'Repo Fixtures'], ['user.email', 'fixtures@example.invalid']]) {
    await git(bundle, repository, ['config', '--local', key, value], { signal });
  }
}
async function commit(bundle, repository, message, signal) {
  await git(bundle, repository, ['add', '--all', '--', '.'], { signal });
  await git(bundle, repository, ['commit', '-qm', message], { signal });
}

function statusRecords(output) {
  const fields = output.split('\0'); if (fields.at(-1) === '') fields.pop();
  const records = [];
  for (let i = 0; i < fields.length; i++) {
    const value = fields[i]; if (value.length < 4 || value[2] !== ' ') throw new Error('Unexpected Git status format.');
    const record = { index: value[0], worktree: value[1], path: value.slice(3) };
    if (/[RC]/.test(value.slice(0, 2))) { if (!fields[i + 1]) throw new Error('Incomplete Git rename status.'); record.from = fields[++i]; }
    records.push(record);
  }
  return records.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}

/** Creates only a new directory; never cleans up or executes a consumer program. */
export async function createFixture(scenario, destination, { signal } = {}) {
  if (!catalogue.some(([id]) => id === scenario)) throw new Error('Unknown scenario. Run repo-fixtures list.');
  if (typeof destination !== 'string' || !destination || destination.includes('\0')) throw new Error('Provide a new destination directory.');
  signal?.throwIfAborted();
  const target = path.resolve(destination);
  // Resolve the parent so junctions/symlinks do not change what directory we own.
  let parent;
  try { parent = await realpath(path.dirname(target)); } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') throw new Error('The destination\'s parent directory must already exist.');
    throw error;
  }
  const bundle = path.join(parent, path.basename(target));
  try { await mkdir(bundle); } catch (error) { if (error.code === 'EEXIST') throw new Error('Destination already exists; choose a new directory.'); throw error; }
  // Failure intentionally leaves a clearly marked partial bundle; no recursive deletion.
  await writeFile(path.join(bundle, 'INCOMPLETE.txt'), 'Fixture creation did not finish. This directory was newly created by Repo Fixtures. Inspect it before removing it.\n', { flag: 'wx' });
  await writeFile(path.join(bundle, 'empty.gitconfig'), '', { flag: 'wx' });
  await mkdir(path.join(bundle, 'empty-hooks'));
  const repository = path.join(bundle, 'repo');
  const primary = scenario === 'linked-worktree' ? path.join(bundle, 'upstream') : repository;
  await init(bundle, primary, signal);
  await file(primary, '.gitignore', 'ignored/\n.agent-lanes/\n');
  await file(primary, 'src/app.txt', 'baseline\n');
  await commit(bundle, primary, 'Fixture baseline', signal);
  if (scenario === 'linked-worktree') {
    await git(bundle, primary, ['worktree', 'add', '-q', '-b', 'fixture/worktree', '--', repository, 'main'], { signal });
  }
  const base = (await git(bundle, repository, ['rev-parse', 'HEAD'], { signal })).trim();
  if (scenario === 'dirty') {
    await writeFile(path.join(repository, 'src/app.txt'), 'unstaged change\n');
    await file(repository, 'new file.txt', 'untracked\n'); await file(repository, 'ignored/cache.txt', 'ignored\n');
  } else if (scenario === 'staged') {
    await writeFile(path.join(repository, 'src/app.txt'), 'staged change\n');
    await git(bundle, repository, ['add', '--', 'src/app.txt'], { signal });
    await writeFile(path.join(repository, 'src/app.txt'), 'unstaged change after staging\n');
  } else if (scenario === 'rename') {
    await rename(path.join(repository, 'src/app.txt'), path.join(repository, 'src/renamed file.txt'));
    await git(bundle, repository, ['add', '--all', '--', 'src'], { signal });
  } else if (scenario === 'conflict') {
    await git(bundle, repository, ['switch', '-qc', 'fixture/theirs'], { signal });
    await writeFile(path.join(repository, 'src/app.txt'), 'theirs\n'); await commit(bundle, repository, 'Theirs', signal);
    await git(bundle, repository, ['switch', '-q', 'main'], { signal });
    await writeFile(path.join(repository, 'src/app.txt'), 'ours\n'); await commit(bundle, repository, 'Ours', signal);
    await git(bundle, repository, ['merge', '--no-edit', 'fixture/theirs'], { signal, expected: 1 });
  } else if (scenario === 'unusual-paths') {
    await file(repository, 'src/café 文件.txt', 'unicode baseline\n'); await commit(bundle, repository, 'Unicode path', signal);
    await writeFile(path.join(repository, 'src/café 文件.txt'), 'unicode change\n');
    await file(repository, 'untracked space 文件.txt', 'untracked\n');
  } else if (scenario === 'submodule') {
    const upstream = path.join(bundle, 'upstream'); await init(bundle, upstream, signal);
    await file(upstream, 'child.txt', 'local submodule\n'); await commit(bundle, upstream, 'Child baseline', signal);
    // A relative URL keeps the destination's absolute path out of the committed
    // .gitmodules, so HEAD is the same wherever the bundle is created or moved.
    // Without a remote, Git resolves it against the superproject's worktree.
    await git(bundle, repository, ['-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', '--', '../upstream', 'modules/child'], { signal });
    await commit(bundle, repository, 'Add local submodule', signal);
  }
  const observations = await observe(bundle, repository, signal);
  const expected = expectations(scenario);
  for (const key of ['status', 'conflicts', 'submodules']) {
    if (JSON.stringify(observations[key]) !== JSON.stringify(expected[key])) throw new Error(`Generated ${scenario} fixture does not match expected ${key}; inspect the marked partial bundle.`);
  }
  const manifest = { version: 1, generator: { name: '@hexmillionaire/repo-fixtures', version: VERSION }, scenario, repository: 'repo', base,
    ...(scenario === 'linked-worktree' ? { layout: { kind: 'linked-worktree', primaryRepository: 'upstream', branch: 'fixture/worktree' } } : {}),
    expectations: expected, observations,
    limits: ['Synthetic Git state; not a model evaluation or test-correctness claim.', 'Git hashes are SHA-1 and timestamps fixed; byte-for-byte bundles are not promised across Git versions/platforms.', 'The submodule scenario refers to its sibling upstream directory by the relative URL ../upstream; keep the complete bundle together.',
      ...(scenario === 'linked-worktree' ? ['Linked worktrees use Git-managed absolute administrative paths. Keep the bundle at its original location; use git worktree repair (Git 2.30+) after deliberately moving it; recreate it instead on older Git.'] : [])] };
  await writeFile(path.join(bundle, 'fixture.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  await writeFile(path.join(bundle, 'INCOMPLETE.txt'), 'Repo Fixtures finished. Read fixture.json; the disposable Git repository is in repo/. No consumer tools were executed.\n');
  await rename(path.join(bundle, 'INCOMPLETE.txt'), path.join(bundle, 'CREATED.txt'));
  return { directory: bundle, repository, manifest };
}

function expectations(scenario) {
  const records = {
    clean: [], dirty: [{ index: '?', worktree: '?', path: 'new file.txt' }, { index: ' ', worktree: 'M', path: 'src/app.txt' }],
    staged: [{ index: 'M', worktree: 'M', path: 'src/app.txt' }],
    rename: [{ index: 'R', worktree: ' ', path: 'src/renamed file.txt', from: 'src/app.txt' }],
    conflict: [{ index: 'U', worktree: 'U', path: 'src/app.txt' }],
    'unusual-paths': [{ index: ' ', worktree: 'M', path: 'src/café 文件.txt' }, { index: '?', worktree: '?', path: 'untracked space 文件.txt' }],
    submodule: [], 'linked-worktree': [],
  };
  return { status: records[scenario], conflicts: scenario === 'conflict' ? ['src/app.txt'] : [], submodules: scenario === 'submodule' ? ['modules/child'] : [] };
}
async function observe(bundle, repository, signal) {
  const [status, index, head, branch, gitVersion] = await Promise.all([
    git(bundle, repository, ['status', '--porcelain=v1', '-z', '--untracked-files=all'], { signal }),
    git(bundle, repository, ['ls-files', '--stage', '-z'], { signal }), git(bundle, repository, ['rev-parse', 'HEAD'], { signal }),
    git(bundle, repository, ['branch', '--show-current'], { signal }), git(bundle, repository, ['--version'], { signal }),
  ]);
  const entries = index.split('\0').filter(Boolean);
  const conflicts = [...new Set(entries.filter(value => !/^[0-7]{6} [a-f0-9]+ 0\t/.test(value)).map(value => value.slice(value.indexOf('\t') + 1)))].sort();
  return { gitVersion: gitVersion.trim(), head: head.trim(), branch: branch.trim(), status: statusRecords(status), conflicts,
    submodules: entries.filter(value => value.startsWith('160000 ')).map(value => value.slice(value.indexOf('\t') + 1)).sort() };
}
