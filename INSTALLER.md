# Install and remove

Prerequisites: macOS, Node 22+, npm; authenticated Codex CLI for Codex work or authenticated Claude Code CLI for Claude work. Demo needs no model login. No administrator access is needed.

1. Obtain the reviewed source/release and enter its directory.
2. Run `npm ci && npm run build`.
3. Run `node scripts/install.mjs --root /absolute/project-parent`.
4. For file editing, pass `--write`. For demo, pass `--demo`. For a CLI outside PATH, pass `--codex /Applications/ChatGPT.app/Contents/Resources/codex` or `--claude /absolute/path/to/claude`.
5. Run the printed launcher with `doctor`. Paste the generated `mcp-client.json` snippet into a local MCP host or use its CLI from a local-execution assistant.

A convenient double-click entry is `scripts/Install.command` after prerequisites/build. It asks for a project directory and uses safe defaults. This is a launcher, not a signed native app.

Default installation folder: `~/.local/share/cos-codex-bridge`. `--prefix /absolute/path` chooses another. It contains config, state, launcher and an MCP snippet. Source remains in the original checkout; moving it breaks the launcher. No shell profile/client settings are automatically edited. Installation refuses overwrite, including configuration; inspect a partial prefix after a failed run. Do not place installation/config/state inside an allowed project root.

Edit `projects` in config to give exact directories friendly aliases, e.g. `Website` and `Research`. Only configure folders you intend the assistant to access. The installer allows the supplied parent; all descendants are in scope. Use individual project roots for a narrower configuration.

Claude Code needs its own supported sign-in, such as `claude auth login --claudeai` for an existing subscription. In an existing installation, add `"claudeBinary":"/absolute/path/to/claude"` to the private `config.json` if the MCP host cannot find `claude`, then restart that host and run doctor. The bridge does not create a Claude account Project or auto-place CLI sessions in Claude Desktop. See [Claude Code route](docs/CLAUDE.md).

## Updating

Stop or finish existing jobs. Preserve config/state. Review the new source and lockfile, then run `npm ci && npm run build` in the same source path. Rerun doctor and tests. Do not overwrite live worker code during a running job. App Server is experimental; unexpected policy/schema changes should fail rather than silently weaken scope.

## Uninstall

Remove the MCP entry from the client and stop invoking the launcher. Request cancellation of each active receipt and verify interruption first. Delete the chosen installation prefix to remove launcher/config and all stored prompts, receipts and demo sessions. Delete source separately if desired. This does not delete actual Codex session history or undo project changes. Use Codex's own controls for its history.

## Troubleshooting

- `CODEX_UNAVAILABLE`: specify a valid CLI; demo is never silently substituted.
- `CONFIG`: choose specific existing directories; keep state private and outside project scope.
- `POLICY_MISMATCH` / `UNSUPPORTED_CONFIG`: Codex configuration cannot be safely constrained; no turn is sent. Review version/config rather than disabling checks.
- `CAPACITY` / `SESSION_BUSY`: poll active jobs; do not submit duplicates.
- `SIZE_LIMIT`: split the work deliberately; the bridge never cuts a prompt silently.
- `uncertain`: inspect the returned thread and workspace before creating a new request ID.
- No Grok connection: stdio is local. A cloud connector URL cannot directly run a process on your Mac. See the client recipe.
- Claude authentication unavailable: run `claude auth status` in the same macOS account and `doctor` from the actual MCP host. Desktop sign-in does not itself guarantee CLI sign-in or keychain access in a sandboxed host.

## Desktop option

The register action is available on macOS with a compatible Codex desktop CLI. Private legacy assignment is disabled in new installs; desktopLegacyAssignment:true is an explicit experimental option, currently gated to 0.153.4. Back up configuration before enabling it. See [SECURITY.md](SECURITY.md#optional-desktop-compatibility-adapter) for backup and race limitations. Native assignment and visible sidebar rendering are separate checks.

## Clean-tree evidence (2026-09-19)

A sanitized source tree was copied to a new candidate directory, then `npm ci`, `npm test`, installation into an empty temporary prefix with `--demo`, and the generated launcher `doctor` all passed. This validates a clean dependency tree and isolated installation without copying private config or credentials. It is not proof of a fresh human Codex account or a Windows/Linux Desktop install.

Reproduce from a clean checkout:

```sh
npm ci
npm test
mkdir -p /tmp/cos-install-check/workspace
node scripts/install.mjs --root /tmp/cos-install-check/workspace --prefix /tmp/cos-install-check/prefix --demo
/tmp/cos-install-check/prefix/cos-codex-bridge doctor
```

Choose a fresh empty prefix on repeat; existing configuration is never overwritten. For real mode, omit --demo and authenticate Codex through its own supported login flow.
