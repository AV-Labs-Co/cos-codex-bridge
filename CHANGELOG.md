# Changelog

## 0.2.0-beta.1 — Claude Code CLI route

One local MCP now supports an optional `provider:"claude-code"` route alongside the default Codex route. It creates approved local project folders, starts and resumes saved Claude Code CLI sessions, finds and reads their transcripts, and shares durable request IDs, prompt/artifact hashes and cancellation. The bridge checks the returned session ID and refuses unsupported Claude Desktop session continuation rather than silently forking.

This beta does not create Claude account Projects, ordinary chats, Cowork projects or Claude Desktop sidebar sessions. Codex-specific pinning, Desktop registration, queueing and Steer remain on the Codex route. Existing Codex receipt fingerprints retain their original format for replay across the upgrade.

## 0.1.1 — package and registry release candidate

Align package metadata, MCP server version and the official Registry entry for the first package publication. The v0.1.0 GitHub preview tag remains an earlier source snapshot. Runtime behavior and the Desktop writer-lock limitation are unchanged.

## 0.1.0 — preview

Local stdio MCP and JSON CLI; exact project/task routing; durable receipts, hashes and idempotent request IDs; text artifacts; direct-worker clarification/cancellation; Desktop registration, native assignment and pin controls; explicit Desktop queue delivery and same-item recovery when the writer is available.

Free under MIT. Default execution is read-only with explicit project roots. Desktop-owned paused-queue recovery is deferred: a human Steer click may be needed. Earlier macOS Desktop field testing used Codex 0.153.4. Newer Desktop sidebar rendering is not certified; the optional legacy adapter is off by default and fails closed outside its tested version. This preview does not promise universal unattended Desktop control.

Release review includes source boundary inspection, automated tests, dependency audit and a clean-prefix installation. See docs/SECURITY-REVIEW.md for scope and limitations.
