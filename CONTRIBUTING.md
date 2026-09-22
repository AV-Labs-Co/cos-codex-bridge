# Contributing

Thanks for helping improve CoS Codex Bridge.

## Good first contributions

- Reproduce installation on another MCP client or operating system.
- Improve error messages without weakening project boundaries.
- Add tests for Codex App Server compatibility changes.
- Report an installation problem with private paths and prompts removed.

## Before opening a pull request

1. Create a focused branch.
2. Run `npm ci`.
3. Run `npm test`.
4. Run `npm pack --dry-run` and inspect the published file list.
5. Describe the behavior before and after the change.

Do not include credentials, full private prompts, Codex state files, receipt stores or private filesystem paths. New write capabilities must remain inside configured allowlisted roots and need corresponding boundary tests.

For security concerns, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.
