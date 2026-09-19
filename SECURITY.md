# Security model

This is a local, single-owner preview. Do not expose its process or state directory to untrusted users or publish it as an unauthenticated HTTP service.

## Enforced boundaries

- No default workspace permission. Absolute roots are canonicalized with realpath; `/`, entire home, traversal/sibling prefix confusion and static symlink escapes are rejected.
- Session metadata is checked against allowed directories before returning full conversation content or resuming. Caller must choose the session's exact project.
- Config and private state must be outside allowed roots. State is mode 0700; receipt/payload files are 0600. Existing artifacts are never overwritten.
- Codex read-only is default; optional workspace-write excludes extra temporary directories and disables tool network. Required approval/sandbox/cwd policy is checked before dispatch; mismatches fail closed.
- Inherited MCP connectors are disabled per session. Bridge declines permission requests and exposes no tool to widen permissions. Browser, apps/plugins, computer use, automation and web search features are disabled through current Codex configuration.
- Explicit byte limits, strict schemas, stable request IDs, bounded parallel jobs, timeouts and thread locks prevent common accidental overload/duplicate work.

## Limits and trust

The allowlist governs bridge routing/file tools. It is **not** a promise that Codex cannot read any file outside those roots. Codex sandbox rules govern child tool access. Local source/config, the installed Codex binary, your account, and the calling assistant are trusted. Same-user malicious processes, hostile root-directory replacement races and compromised dependencies are outside this preview's protection.

A resumed session retains old content. Research, file content, session names and model output can contain prompt injection. The caller must treat them as data. Prompt policy adds defense but is not an authorization boundary. Restrictive tool/network settings reduce external-action paths; no absolute guarantee is made against a compromised CLI or platform sandbox escape. Do not add credentials to project files or untrusted tools to this workflow.

Codex uses its existing login; prompts and attached artifacts go to the configured model provider. The bridge has no separate telemetry, cloud storage, token capture or HTTP listener. Private local state stores **full prompts and artifact copies**, hashes and output tails in plaintext protected by filesystem permissions. No automatic deletion/retention policy is applied. Delete state only after stopping jobs and accepting loss of receipts/idempotency history.

`completed` is not independent verification. `uncertain` requires inspecting the actual thread/workspace; do not blindly resend. Cancellation does not roll back changes. Approval denial can leave a task incomplete; the model may still finish with a blocker explanation.

Project creation/artifact writing are explicit bridge filesystem operations even when the Codex sandbox is read-only. They remain scoped; that sandbox setting specifically governs Codex execution.

## Reporting

Email contact@aninvievelabs.com with reproduction steps and a sanitized version/config. Do not include credentials or private prompts. This is a proposed security contact, not a guaranteed SLA. Use a private channel for sensitive findings. Public release is gated on review of the exact package contents and supported Codex version.

## Optional desktop compatibility adapter

With explicit desktopLegacyAssignment:true, the bridge may edit the two legacy desktop project-assignment/order keys for scoped tasks after native assignment. Private original-state backups stay in stateDir/desktop-backups and may contain sensitive desktop metadata. Do not publish them. Atomic replacement and pre-write conflict checks cannot eliminate races with Desktop saves, which do not share the bridge lock. The adapter is off by default and gated to tested CLI 0.153.4. It never rewrites rollout originators/history or changes selected-project.

## Explicit Desktop queue boundary

`acceptDesktopPolicy:true` is mandatory for queue routing. This route inherits the already-existing task's policy; the bridge's restricted direct-worker sandbox does not constrain that Desktop task. Queue receipts do not imply permission approval or publication authorization. No prompt is put into a shell command line. No queue operation steals a writer, forks a task or treats missing correlation as delivery. A lost acknowledgement is uncertain. Direct-worker cancellation cannot cancel Desktop queue work.
