# Security

Only create synthetic fixtures in a new directory. Repo Fixtures invokes Git directly with fixed argument arrays, disables hooks during creation, isolates inherited Git configuration and uses a fictional identity. It never executes a consumer program. The disposable repository is still a real Git repository: do not run unknown programs or commands merely because a fixture describes them.

Trusted local filesystem access is assumed. This is not isolation against another process with write access to the same directories, nor a sandbox for arbitrary third-party fixtures. The submodule source is locally generated; there are no remote URLs or downloads.

Report a suspected vulnerability through GitHub's private security reporting if available. Use public issues only for non-sensitive reproduction details. Do not post secrets or private source files.
