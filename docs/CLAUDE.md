# Claude Code support (preview)

CoS Codex Bridge is **one local MCP** with two coding-agent routes. Set `provider:"claude-code"` on `bridge_projects`, `bridge_sessions` and `bridge_submit` to use Claude Code. Omit `provider` for the existing Codex behavior. The receipt, cancellation and artifact tools are shared.

This route uses the **Claude Code CLI**, not ordinary Claude chats or Claude account Projects. A Claude Code project here means an approved local folder. `bridge_projects` can create that folder; the first `bridge_submit` creates a saved Claude Code CLI session in it. The bridge can then find, read and continue that CLI session by ID. It does not create a Claude Desktop sidebar entry, cloud project, Cowork project, or claude.ai chat. A saved Desktop transcript may appear in search with `resumable:false`; the bridge refuses to send to it rather than guessing that the CLI can take it over.

## Setup

Install the bridge normally and install/sign in to [Claude Code](https://code.claude.com/docs/en/quickstart) on the same machine. `claude auth login --claudeai` uses an existing Claude subscription; the bridge never collects a password or API key. The installer accepts `--claude /absolute/path/to/claude` when the MCP client's PATH will not find it. In an existing private config, set `claudeBinary` to that absolute executable path and restart the MCP host. `bridge_doctor` reports whether this process can find the CLI and see its signed-in state. A sandboxed host may see different keychain access from a normal terminal.

Default execution is read-only. Install with `--write` or set `sandbox:"workspace-write"` to allow edits inside the selected project. Claude is launched with restricted tools, no inherited MCP servers or browser, no permission prompts, a strict Bash sandbox when Bash is enabled, no unsandboxed retry, and no network access for shell subprocesses. The bridge passes a minimal child environment; custom Bedrock/Vertex or environment-key authentication is not part of this preview. Claude itself still sends the prompt to Anthropic under the user's existing account.

## A complete local project handoff

1. `bridge_projects` with `provider:"claude-code"`, `action:"create"`, an allowlisted `parent` and a new `name`. The response says `claudeCodeProjectReady:true` and `desktopRegistered:false`.
2. `bridge_submit` with `provider:"claude-code"`, the new `project` path, full `prompt`, and a stable `requestId`. Keep the returned `receiptId` and reserved `threadId`.
3. Poll `bridge_receipt`. `queued` and `accepted` are not completion. Wait for `completed` and `sessionConfirmed:true`; an `uncertain` result requires inspection before any retry.
4. `bridge_sessions` with `provider:"claude-code"` and the project path finds saved sessions. Read one with `action:"read"`, `threadId`, and `includeOutput:true`.
5. Follow up with `bridge_submit`, the same `provider`, `project` and `threadId`, a new stable `requestId`, and the next prompt. The CLI resumes that exact saved session; a returned different ID is `SESSION_MISMATCH`, not success.

For example, a CoS can create a folder for a research idea, send the whole plan to Claude Code, check the result, and continue the same session with review notes. `bridge_artifact` can add scoped text files and `bridge_cancel` can stop bridge-owned running work. Request IDs deduplicate submissions and byte limits apply before dispatch.

## Differences from Codex

Claude Code CLI does not expose the Codex Desktop project registration, task pinning, queue, Steer or clarification APIs used by the Codex route. Those actions remain Codex-only. The Claude route does not control already-running Claude Desktop sessions and does not claim to manage ordinary Claude chats, Cowork, Dispatch or cloud Projects. We do not silently fork a busy session or represent a saved transcript as live Desktop progress.

The initial 2026-09-23 macOS field check used Claude Code 2.1.269: a read-only first prompt completed with the exact marker, a follow-up in the same ID recalled it, and a separate restricted write-mode prompt created a file with exact verified content. These are local Claude Code CLI proofs, not Claude Desktop sidebar proofs. Automated tests cover allowlist routing, Desktop-session refusal, cancellation, prompt/artifact hashes, idempotency and fork detection.

A separate Chief of Staff field test on the same date used Grok Bot's installed bridge to create one approved local folder, submit a marker prompt, receive a completed receipt, and follow up in the same Claude Code CLI session. Both receipts and the native Claude Code session file were independently checked. The test did not open or control a Claude Desktop or claude.ai Project.

Anthropic documents [CLI session IDs and resume](https://code.claude.com/docs/en/cli-reference), [Desktop's separate CLI session list](https://code.claude.com/docs/en/desktop), and [strict sandbox settings](https://code.claude.com/docs/en/sandboxing). Their interfaces can change; doctor and receipts should be checked on the installed version.
