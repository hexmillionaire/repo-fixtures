# Contributing

Use Node 24.8+ and Git. Clone the repository, run `npm test`, then `npm run test:package`. No dependency install or model account is needed. The archive smoke test requires npm because it tests a fresh production installation.

For a bug, include a minimal command, scenario, Git/Node/OS versions, expected and actual observations, and fictional file contents. Avoid sharing your private repository, credentials or personal absolute paths. Reproduce it first with an existing scenario if possible.

For a new scenario, explain the developer-tool failure it exposes, specify expected status/conflicts/submodules independently, test with real Git, and preserve the new-directory-only rule. Do not add arbitrary shell execution, network cloning, recursive cleanup or user configuration mutation. Generated Git configuration must stay inside the owned bundle.

Open a focused pull request with the behavior change and checks run. The issue forms offer bug reports and scenario requests. Documentation, examples, Windows portability fixes and smaller reproduction cases are welcome first contributions. We do not promise response times or compatibility with every Git version.
