# Changelog

## Unreleased

## 0.2.0

- Add a real `linked-worktree` scenario with a `.git` file, shared objects and separate index/worktree state, plus manifest layout information and movement limits.
- Test Node 26 LTS on Linux, Windows and macOS while retaining Node 24 and minimum Node 24.8 coverage.
- Security: the dogfood policy denies `.github/workflows/**` in every lane. GitHub runs a `pull_request` workflow from the PR head, so a lane that may edit workflow files can rewrite the scope check that gates it and still report green.
- The scope workflow pins the Agent Lanes action to the 0.4.1 release commit instead of a 0.2.0 commit that predates the hidden-file deny fix.

## 0.1.1

- Fixed: the `submodule` scenario commits the relative URL `../upstream`, so its HEAD no longer depends on (or records) the absolute destination path.
- A missing destination parent directory now produces a plain error message.
- Docs: `npx` usage and an `llms.txt` summary for agents. Package metadata: homepage, bugs URL and keywords.

## 0.1.0

- Seven real Git scenarios for portable reproduction bundles.
- CLI and ESM API with separate expected/observed JSON facts.
- Exclusive new-directory creation, inherited Git configuration isolation, cancellation and marked partial failures.
- Real Git tests and fresh production archive installation on a three-OS CI matrix.
