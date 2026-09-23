# CoS Codex Bridge

**Your Chief of Staff. Now in charge of Codex, too.**

![CoS Codex Bridge connects a Grok Bot Chief of Staff to Codex projects and tasks](docs/assets/cos-codex-bridge-hero.png)

[![CI](https://github.com/AV-Labs-Co/cos-codex-bridge/actions/workflows/ci.yml/badge.svg)](https://github.com/AV-Labs-Co/cos-codex-bridge/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/AV-Labs-Co/cos-codex-bridge?include_prereleases&label=release)](https://github.com/AV-Labs-Co/cos-codex-bridge/releases)
[![npm stable](https://img.shields.io/npm/v/cos-codex-bridge?label=npm%20stable)](https://www.npmjs.com/package/cos-codex-bridge)
[![License: MIT](https://img.shields.io/badge/license-MIT-gold.svg)](LICENSE)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-43853d.svg)](https://nodejs.org/)
[![CoS Codex Bridge MCP server – quality and maintenance score on Glama](https://glama.ai/mcp/servers/AV-Labs-Co/cos-codex-bridge/badges/score.svg)](https://glama.ai/mcp/servers/AV-Labs-Co/cos-codex-bridge)

A local MCP server that lets a Chief of Staff client find Codex tasks, create project work, deliver whole prompts, follow progress and continue the same conversation. An optional Claude Code CLI route in the same MCP does this with local project folders and saved CLI sessions. Free MIT core. No bridge subscription or checkout. Your existing Codex or Claude Code access is required for real execution.

**Choose your release:** [`0.1.1` on npm](https://www.npmjs.com/package/cos-codex-bridge) is the stable Codex-only route (`@latest`). [`0.2.0-beta.1`](https://www.npmjs.com/package/cos-codex-bridge/v/0.2.0-beta.1) adds Claude Code CLI support (`@beta`) in the same MCP. Install locally, connect your client, then use the `bridge_*` tools. No daemon or Desktop-owner adapter installation is required. The Codex core workflow and the Grok Bot → Claude Code CLI handoff have passed owner field testing on macOS. Desktop-owned paused-queue recovery remains a known Codex limitation. Sidebar rendering on newer Codex Desktop versions is not certified; check the compatibility table before relying on it. A queued receipt is never proof that work started.

## What your Chief of Staff can do

- Turn research or a product idea into a new Codex project and task.
- Send the complete prompt and attached text without manual copying and pasting.
- Find an existing Codex task, read its progress and continue the same conversation.
- Track delivery with durable receipts instead of assuming an accepted prompt ran.
- Rename, assign, pin and cancel scoped work across approved projects.
- Keep local project access inside explicit allowlisted directories.

Example: “Create a project for this idea, send my research to Codex, monitor the build, and follow up in the same task with the review findings.”

### Claude Code route (beta)

The same MCP can now start and continue **Claude Code CLI** work. Pass `provider:"claude-code"` to `bridge_projects`, `bridge_sessions` and `bridge_submit`; the existing Codex route remains the default. A local folder is the Claude Code project context. The bridge creates a saved CLI session there, returns a durable receipt, reads its result and follows up in the same session. This was locally tested with Claude Code 2.1.269, including a real file edit in a disposable folder.

In an owner field test, the Grok Bot Chief of Staff used the installed MCP to create an allowlisted folder, send a prompt to Claude Code, read its completion, and follow up in the **same saved session**. Both bridge receipts and Claude Code's native session history were checked. This proves the local CLI handoff, not Claude Desktop or account Project control.

Claude account Projects, ordinary chats, Cowork/Dispatch and Desktop-owned sessions are separate surfaces. This route does not create or control them, and a CLI session does not automatically appear in Claude Desktop's sidebar. [Claude setup, exact workflow and limits](docs/CLAUDE.md).

### See the handoff

<p align="center">
  <img src="docs/assets/cos-codex-bridge-demo.webp" width="360" alt="Animated illustration of a Grok Bot Chief of Staff sending work through CoS Codex Bridge to Codex">
</p>

The animation illustrates the local handoff. It uses no private Desktop data or
project screenshots.

## Try the safe demo

This exercises the MCP workflow locally without a Codex account, model call or project changes:

```sh
git clone https://github.com/AV-Labs-Co/cos-codex-bridge.git
cd cos-codex-bridge
npm ci
npm run demo
```

The demo prints a completed receipt, payload hash and task metadata so you can see the bridge contract before granting access to a real project.

## Easiest setup: give this link to your local assistant

[Open the repository and installation instructions](https://github.com/AV-Labs-Co/cos-codex-bridge#install). An assistant with local terminal access can install it for you. A browser-only or cloud-only chat cannot install software on your computer.

Copy this installation request to your Chief of Staff:

> Install CoS Codex Bridge from https://github.com/AV-Labs-Co/cos-codex-bridge. Read the README and SECURITY.md first. Use only a project folder I approve, keep read-only defaults, and preserve existing client configuration. Follow the installer instructions, run doctor, and connect the generated stdio MCP entry to my local client. Tell me what passed and what still needs setup. Wait for my first task before submitting any work. Do not publish or deploy anything.

You can also download the source archive from [Releases](https://github.com/AV-Labs-Co/cos-codex-bridge/releases), extract it and follow the steps below. Git cloning makes later updates easier. A [public npm package](https://www.npmjs.com/package/cos-codex-bridge) is available, but no hosted endpoint is required.

## Install

Requires Node.js 22+, npm, a locally authenticated Codex CLI for Codex work and/or Claude Code CLI for Claude work, and a local client supporting stdio MCP. Codex Desktop registration additionally requires Codex Desktop on macOS.

```sh
git clone https://github.com/AV-Labs-Co/cos-codex-bridge.git
cd cos-codex-bridge
npm ci
npm test
node scripts/install.mjs --root /absolute/path/to/your/projects
```

The installer writes a private config, launcher and MCP snippet under `~/.local/share/cos-codex-bridge`. Keep the checkout in place. Default execution is read-only; use `--write` only for approved project edits. Choose specific project roots, never your entire home directory. Add `--codex /absolute/path/to/codex` or `--claude /absolute/path/to/claude` if either CLI is not on the MCP client's PATH. See [installer and upgrade steps](INSTALLER.md).

If you prefer npm to Git, install a pinned release into a dedicated folder, then run its same local installer. Use `@0.1.1` for stable Codex only or `@0.2.0-beta.1` for Codex plus the Claude Code CLI preview:

```sh
mkdir -p "$HOME/.local/share/cos-codex-bridge-package"
npm install --prefix "$HOME/.local/share/cos-codex-bridge-package" cos-codex-bridge@0.2.0-beta.1
node "$HOME/.local/share/cos-codex-bridge-package/node_modules/cos-codex-bridge/scripts/install.mjs" --root "/absolute/path/to/your/projects"
```

Keep that package folder: the generated launcher points to it. The npm path was checked with a clean `@beta` install, isolated demo config and `doctor`. The installer does not edit any MCP client settings for you.

```sh
~/.local/share/cos-codex-bridge/cos-codex-bridge doctor
```

Check `codexAvailable`, `claudeCodeAvailable`, `claudeCodeAuthenticated`, `mode`, `sandbox` and `roots`. The Claude sign-in check is made from the MCP host's process and may differ from a sandboxed terminal; doctor does not verify Desktop sidebar rendering. For a model-free demo, install into a separate prefix with `--demo`.

Paste the generated `mcp-client.json` into your client's MCP configuration. Equivalent shape:

```json
{"mcpServers":{"cos-codex-bridge":{"command":"/absolute/path/to/node","args":["/absolute/path/to/cos-codex-bridge/dist/cli.js","--config","/absolute/path/to/config.json","mcp"]}}}
```

## A complete handoff

Tell your Chief of Staff: “Find my app project, send this entire implementation brief to Codex, monitor it, then continue that same task with the review findings.”

1. Resolve the exact project and task with `bridge_projects` and `bridge_sessions`.
2. Create a directory if needed, then **register** it. A directory alone is not a Desktop project.
3. Call `bridge_submit` with `project`, the whole `prompt`, and a stable `requestId`. Include `threadId` for follow-ups.
4. Poll `bridge_receipt`. Verify hashes, task ID and eventual completion. Handle clarification with `bridge_answer`.
5. Use `bridge_session_manage` to rename, assign or pin the task. Stored metadata and visible Desktop rendering are separate proofs.

A successful model completion does not independently prove that generated code works. Review and test the result.

## Ten tools, twelve features and one known limitation

| Tool | Purpose |
|---|---|
| `bridge_projects` | List aliases, create a folder, register/open or inspect a Desktop project |
| `bridge_sessions` | Find and read existing allowed tasks, including externally created tasks |
| `bridge_submit` | Start or follow up; stable request IDs and complete UTF-8 payloads |
| `bridge_receipt` | Durable progress, hashes, bounded output and explicit uncertainty |
| `bridge_steer` | Retry recovery of an existing bridge queue item, without resending it |
| `bridge_answer` | Answer pending clarification; never approve permission expansion |
| `bridge_cancel` | Request cancellation of bridge-owned direct work |
| `bridge_artifact` | Read/write versioned text artifacts without overwrite |
| `bridge_session_manage` | Rename, pin/unpin and assign to a registered project |
| `bridge_doctor` | Report mode, Codex version, scope and honest capability limits |


Known limitation (uncommon):
If a session already has an active writer and a steering prompt is sent, the prompt waits for a natural pause/stopping point. On a long autonomous run, the only human intervention needed is pressing Steer in that case.

See the [v1 capability contract](docs/FEATURES.md) and [verification matrix](docs/VERIFICATION.md).

## Busy tasks, steering and interruption recovery

Direct submission defaults to `SESSION_BUSY` when another writer owns the task. To opt into the existing Desktop execution policy, use `onBusy:"queue"` and `acceptDesktopPolicy:true`. `delivery:"desktop-queue"` explicitly queues to an existing task. These paths use Codex's first-party queue API, the equivalent of `codex queue`, and preserve separate text inputs and stable client message IDs.

Receipts distinguish `busy`, `queued`, `steered`, `delivered`, `completed`, `blocked` and `uncertain`. `thread/queue/start` recovery has passed a local live test with the writer available. **Desktop-owned paused recovery is deferred for v0.1; it may require a human Steer click.** `bridge_steer` retries the exact saved item when the writer is available, including an existing CLI-created item adopted by its queue ID. `bridge_sessions` with `includeQueue:true` exposes pending IDs and inferred needs-steer state. It never silently forks or treats queue disappearance as delivery. See [queue semantics](docs/QUEUE.md).

## Security defaults

Default-deny realpath allowlists, read-only direct execution, private local receipts, bounded UTF-8 input, explicit project/task matching and no implicit cloud endpoint. Prompts and artifacts are stored locally in plaintext for receipt integrity; do not treat them as encrypted storage.

Direct workers disable inherited connectors and deny permission approvals. Desktop queue is a separate, explicit policy boundary: it uses the existing task's permissions and tools. The bridge cannot enforce a narrower sandbox inside that already-running task. No automatic store submission, social posting or publication is authorized. See [SECURITY.md](SECURITY.md).

## Client matrix

| Environment | Evidence |
|---|---|
| Grok Bot / CoS on owner's Mac | Codex orchestration and a Claude Code CLI create → complete → same-session follow-up field-tested; installation-specific integration |
| Standard stdio MCP client | Protocol handshake, schemas, errors, installer and demo tested automatically on macOS and Ubuntu |
| Codex Desktop macOS / CLI 0.153.4 | Owner-tested registration, assignment, pinning, continuity and queue delivery |
| Codex Desktop 0.155.0-alpha.9.2 | Native metadata observed in field; sidebar rendering not certified; legacy adapter disabled |
| Other MCP clients | Expected protocol compatibility; not individually field-certified |
| Claude Code CLI 2.1.269 | Local create, complete, read and same-session follow-up verified; restricted file write verified in a disposable folder |
| Claude Desktop/Claude account Projects | No creation, sidebar registration, pinning or live-session control claim; saved local transcript may be readable but not resumable through this route |
| Windows runtime / Linux Desktop integration | Not verified; no macOS Desktop parity claim |
| Ordinary ChatGPT chats | Not supported |
| Hosted service / Composio cloud | Not provided or listed |

Native project assignment is supported through the installed experimental App Server API. An optional, version-gated legacy Desktop assignment adapter has backup and race checks; it is off by default and remains experimental.

## Community

This project focuses on reliable Chief of Staff handoffs rather than a universal superiority claim. Other Codex MCP projects solve useful adjacent workflows. We do not claim “most advanced,” all-account control or blanket autonomy.

[Ask an installation question or share a client recipe in GitHub Discussions](https://github.com/AV-Labs-Co/cos-codex-bridge/discussions). Use Issues for reproducible bugs, with **redacted** version, state and error details. Never post full private prompts or credentials.

Star it to follow development and fork it for your client. [MIT License](LICENSE).
