# Permissions for individual handoffs

Source preview. Not included in published npm 0.1.4 or 0.2.0-beta.1.

`bridge_submit` accepts optional `writeIntent: "read-only" | "workspace-write"` for direct Codex and Claude Code CLI submissions.

```json
{
  "project": "MyProject",
  "prompt": "Review the code and report findings. Do not edit files.",
  "requestId": "review-handoff-001",
  "writeIntent": "read-only"
}
```

A read-only handoff narrows even a write-enabled bridge. A workspace-write handoff requires `sandbox: "workspace-write"` in the bridge configuration; the prompt or request cannot expand configured authority. Omitting writeIntent preserves the existing configured behavior and older request-ID fingerprints. Clients wanting read-only by default should explicitly include `writeIntent: "read-only"` in their review handoffs.

The worker enforces the effective setting through Codex thread/resume and turn sandbox parameters, including the existing returned-policy verification. Claude Code receives its restricted read-only tool list or configured write tools. These are execution settings, not just text instructions. Receipts record `writeIntent` when explicit and `effectiveSandbox`; permission intent is part of request identity. Changing it under the same requestId is a conflict.

Explicit writeIntent is rejected for `delivery: "desktop-queue"` and for `onBusy: "queue"`. Desktop permissions cannot be narrowed reliably by this bridge path. Use direct delivery with `onBusy: "reject"` when per-handoff permissions matter. Queue receipts without explicit intent report `effectiveSandbox: "desktop-policy"` instead of implying the bridge sandbox governs Desktop.

This setting controls submitted model work. It does not change separate bridge artifact/project management tools. Read-only work still writes operational receipts/session metadata outside the model's workspace.

## Verification

Regression tests inspect direct Codex policy dispatch, Claude tool restrictions, refusal of authority expansion and queue fallback, replay after bridge reconstruction, and uncertainty after simulated worker loss. Existing request-ID fingerprints remain compatible when writeIntent is omitted. These checks do not constitute live OS sandbox enforcement or a newly performed Desktop restart.
