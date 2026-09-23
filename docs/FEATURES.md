# V1 capability contract

Known limitation (uncommon):
If a session already has an active writer and a steering prompt is sent, the prompt waits for a natural pause/stopping point. On a long autonomous run, the only human intervention needed is pressing Steer in that case.

Capability #13 remains deferred for v0.1, not a ship blocker. No experimental owner adapter in the default install.


Twelve v0.1 capabilities with explicit verification status; not an exhaustive competitor ranking. Capability #13 is deferred and listed below only as a known limitation.

The v0.2 beta adds an optional Claude Code CLI route to this same MCP. It handles allowlisted local folders, saved CLI sessions, follow-ups, receipts and text artifacts. It does not create Claude account Projects, ordinary chats or Claude Desktop sidebar sessions. See [Claude Code support](CLAUDE.md).

1. Exact-project discovery and external-task continuity with pagination.
2. Separate folder creation, Desktop registration and task assignment.
3. New tasks and follow-ups without copying prompts between interfaces.
4. Verbatim UTF-8 prompt and separate text-artifact delivery, byte counts and SHA-256 hashes.
5. Durable receipt IDs and stable requestId replay; changed payloads reject with IDEMPOTENCY_CONFLICT.
6. Explicit progress, errors and uncertainty rather than invented completion.
7. Busy-task queueing with client-message correlation and durable lifecycle history.
8. Same-item queue recovery through queue/start; verified when writer available. Desktop-owned paused recovery is excluded, as noted below.
9. Realpath allowlists, cross-project rejection and direct-worker read-only defaults.
10. Versioned artifacts with no overwrite and fail-before-send size limits.
11. Clarification replies and direct-worker cancellation, with partial-change honesty.
12. Native assignment, rename, pin/unpin, installer and doctor.
## Known limitation: deferred Capability #13

When Desktop owns the writer and its queue is paused, the bridge cannot unpause it. A human Steer click may be required. This is not a v0.1 ship blocker or a supported capability. Recovery when the writer is available remains verified. No experimental owner adapter or daemon is part of the install.

No claims: ordinary ChatGPT chat control, hosted cloud bridge, Composio listing, all clients/platforms certified, automatic publication, encrypted receipt storage, universal unattended recovery, or “most advanced.”

Prompt plus text artifacts: 256 KiB combined, up to eight artifacts. Standalone artifact storage: 1 MiB. Output tails are bounded. Codex experimental APIs can change.
