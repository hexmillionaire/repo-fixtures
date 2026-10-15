# Changelog

## 0.1.1

- Fixed: the `submodule` scenario commits the relative URL `../upstream`, so its HEAD no longer depends on (or records) the absolute destination path.
- A missing destination parent directory now produces a plain error message.
- Docs: `npx` usage and an `llms.txt` summary for agents. Package metadata: homepage, bugs URL and keywords.

## 0.1.0

- Seven real Git scenarios for portable reproduction bundles.
- CLI and ESM API with separate expected/observed JSON facts.
- Exclusive new-directory creation, inherited Git configuration isolation, cancellation and marked partial failures.
- Real Git tests and fresh production archive installation on a three-OS CI matrix.
