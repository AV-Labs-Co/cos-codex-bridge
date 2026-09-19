# v0.1.0 security review

Reviewed 2026-09-19. This is a maintainer/AI-assisted release review, not an independent penetration test or security certification.

## Scope and results

- Reviewed the bridge source, subprocess invocation, installer, MCP tool schemas, filesystem scope checks, local receipt storage, direct-worker policy verification and explicit Desktop queue boundary.
- All 37 automated tests passed, including path traversal, symlink escapes, wrong-project routing, invalid receipt IDs, private state permissions, payload limits, permission mismatches, queue correlation and installation refusal to overwrite configuration.
- `npm audit` reported zero known vulnerabilities in the dependency tree at review time. This does not detect every vulnerability in dependencies or our own code.
- Gitleaks 8.30.1 scanned the clean source candidate with redacted output and reported no leaks. A separate content review removed personal project examples and checked for private paths and field-test identifiers.
- Clean-tree dependency installation, tests, npm package dry-run, isolated demo installation and generated launcher doctor passed. This is not a new-account Codex authentication test.
- GitHub Actions uses a read-only token and actions pinned to commit IDs. Dependabot update configuration is included.

The public repository starts with new Git history from a selected source tree. Private receipts, prompts, local configuration, field evidence, internal notes and experimental owner-transport prototypes are excluded. Release archives include source and tests, not credentials or an installed account.

## Changes made during review

Unknown tool dispatch now requires an own schema property, rejecting inherited object names such as `constructor`. Additional regression tests cover that case, invalid receipt paths, state-directory symlinks and artifact reads redirected into another project. The installer documentation now uses generic examples and valid public links.

## Remaining limits

This is a trusted, single-owner local process. It is not a multi-user or network-facing service. Same-user malicious processes and changing-directory races are not fully isolated. The allowlist constrains bridge routing and file tools, not every file a Codex sandbox may read. Plaintext local receipts contain full prompts. The existing Codex task's policy applies when the user explicitly opts into Desktop queue delivery.

Desktop-owned paused queues may need a human Steer click. Newer Desktop sidebar rendering is not certified. These limits are documented in README and SECURITY.md. Never infer execution, visual rendering or security from a successful receipt alone.

Report sensitive findings privately using the repository's security reporting channel or the contact in SECURITY.md. Do not include secrets in public issues.
