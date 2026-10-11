# Reproduce a scope audit

Create a fictional fixture, then use Agent Lanes from a clone or release archive. The tools do not depend on one another at runtime.

```sh
repo-fixtures create dirty ./scope-example --json
agent-lanes start example --repo ./scope-example/repo --goal "Inspect the fictional modification" --allow "src/**"
agent-lanes check example --repo ./scope-example/repo --json
```

The audit should report the modified `src/app.txt` as allowed and the untracked `new file.txt` as outside scope. The ignored cache is excluded by Git. Agent Lanes writes only local task metadata; the fixture's `.gitignore` already excludes `.agent-lanes/`.

Repeat with `conflict`: the audit must require review because the index has unresolved stages. Repeat with `submodule`: the top-level worktree can be clean, but Agent Lanes requires a separate submodule audit. A path audit does not establish code correctness or test results.

Share the scenario command, generator version, Git/Node/OS versions and the relevant JSON findings when opening a bug report. Every source file in these scenarios is fictional.
