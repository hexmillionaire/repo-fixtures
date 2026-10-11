# Repo Fixtures

Create a small, inspectable real Git repository when a developer tool breaks on staged changes, renames, conflicts, Unicode paths or submodules. Share the scenario command and `fixture.json` instead of a private working repository.

Dependency-free JavaScript ESM. Requires Git 2.28+ and Node 24.8+; use the latest Node 24 LTS patch. No model API key, network connection or agent client is needed to create a fixture after installation.

## Try it

```sh
git clone https://github.com/hexmillionaire/repo-fixtures.git
cd repo-fixtures
node bin/repo-fixtures.mjs list
node bin/repo-fixtures.mjs create conflict ../my-conflict --json
git -C ../my-conflict/repo status
```

The destination must **not exist**, and its parent must exist. Quote paths with spaces. Successful creation produces a `repo/` Git repository, `fixture.json`, an empty hooks/config directory, and `CREATED.txt`. A failure leaves `INCOMPLETE.txt` and partial files for inspection. This tool never removes directories, cleans your worktree, executes an agent, launches another application or downloads a submodule.

GitHub release archives are independently installable:

```sh
npm install -g https://github.com/hexmillionaire/repo-fixtures/releases/download/v0.1.0/hexmillionaire-repo-fixtures-0.1.0.tgz
repo-fixtures create staged ./my-staged-fixture --json
```

## Scenarios

| ID | Actual state |
| --- | --- |
| `clean` | One committed source file; no changes |
| `dirty` | Unstaged modification, untracked path with a space, ignored cache |
| `staged` | Different index and worktree versions of the same file |
| `rename` | Staged rename into a path with a space |
| `conflict` | Unresolved merge and three-stage index entries |
| `unusual-paths` | Modified and untracked Unicode paths with spaces |
| `submodule` | Committed gitlink pointing to a locally created sibling upstream |

`fixture.json` version 1 contains the generator version, scenario, relative repository path, initial base commit, independently specified expectations and observed Git status/conflicts/submodules. The CLI's JSON result also includes absolute output paths for local use. Review a report before posting it if those paths are private.

Index/worktree status characters are Git porcelain v1 values. Renames include `from`. The initial `base` is intentionally before scenario changes; `observations.head` records the final HEAD. Submodule paths are recorded even when the top-level status is clean. See [a connected scope-audit example](docs/AGENT-LANES.md).

## Library

```js
import { createFixture, listScenarios } from '@hexmillionaire/repo-fixtures';
const result = await createFixture('dirty', './new-fixture');
console.log(result.repository, result.manifest.expectations);
```

`createFixture(scenario, destination, {signal} = {})` returns `{directory, repository, manifest}`. An abort stops active Git work and leaves a marked partial directory if creation already started. `listScenarios()` returns fresh `{id, description}` records. Public report shapes are versioned; the pre-1.0 API can evolve in minor releases. CLI exits 0 on success and 2 for invalid input or creation errors.

## Limits and alternatives

This is a compact bug-report bundle generator. It is not a model benchmark, security sandbox, proof of test correctness, repository capture tool or a configurable scenario DSL. A completed fixture should still be verified by the consuming tool. Git author dates and SHA-1 object format are fixed; byte-for-byte bundles are not promised across Git versions and platforms. Keep the submodule bundle at its original location because its generated local URL refers to the sibling upstream directory.

[git-scenarios](https://git-scenarios.griffen.codes/) already provides a rich composable DSL, many more scenarios, mocks, runner adapters and a CLI. Choose it for custom histories and broad test-suite integration. Repo Fixtures offers seven intentionally small scenarios, no runtime dependencies, a separate expected/observed JSON manifest and no tool launching or cleanup feature. Both can help agents and humans reproduce Git behavior; neither verifies an agent's claims.

## Contribute

Run `npm test` and `npm run test:package`. CI runs real Git fixtures on Linux, Windows and macOS plus minimum Node 24.8. Start with [CONTRIBUTING.md](CONTRIBUTING.md): useful contributions include a minimized failing fixture, portable Git observations, clearer diagnostics and documentation. Include Git/Node/OS versions and fictional data in reports.

Related: [Agent Lanes](https://github.com/hexmillionaire/Agent-Lanes), [Agent Desk](https://github.com/hexmillionaire/agent-desk), [Agent Lanes MCP](https://github.com/hexmillionaire/agent-lanes-mcp), [MCP Surface](https://github.com/hexmillionaire/mcp-surface).
