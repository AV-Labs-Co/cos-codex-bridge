# Queue delivery and recovery

Direct input defaults to rejection on SESSION_BUSY. A caller must explicitly request `onBusy:"queue"` or `delivery:"desktop-queue"`, identify an existing task, and set `acceptDesktopPolicy:true`. This accepts that the existing Desktop task policy applies; it does not grant new permissions or bypass approvals.

The bridge uses first-party `thread/queue/add` with the unchanged input array and stable receipt ID as `clientUserMessageId`. This avoids shell argument exposure and retains artifact boundaries. The queue ID is saved before recovery. A lost enqueue acknowledgement is uncertain and is never automatically retried.

| State | Meaning |
|---|---|
| busy | Direct route unavailable, or caller explicitly selected queue |
| preparing | Mutation intent persisted; acknowledgement pending |
| queued | Queue add acknowledged; no delivery claim |
| steered | Exact queue/start returned a turn ID |
| delivered | Matching client ID or queue/start turn observed |
| completed | That specific turn completed |
| blocked | Queue still waiting and recovery unavailable, or monitoring ended |
| uncertain | Outcome cannot be established; do not resend |

`bridge_steer` takes `threadId`, `receiptId`, `acceptDesktopPolicy:true`. It retries only a known bridge queue item when the prior worker is no longer running. For an existing CLI-created item, first use bridge_sessions read with includeQueue:true. Then pass threadId, the exact queuedSubmissionId, a stable requestId and acceptDesktopPolicy:true to bridge_steer. This adopts the waiting item into a durable receipt without enqueueing again, preserves its original client message ID, and scopes the task before mutation. Unknown or non-text items are rejected. Optional new message delivery uses bridge_submit with a new requestId. Queue inspection reports inferred needsSteer from interruption plus pending items; the private Desktop UI pause flag remains unknown.

Queue disappearance alone is not success. A 30-second observation grace allows persisted task history to catch up; then missing correlation becomes uncertain. If the same client ID is observed later, receipt polling can reconcile it. Worker loss never causes a second add.

A separate App Server can inspect/add items but must resume the task before starting its queue. If Desktop owns the writer, it can refuse resume. The bridge then reports blocked, including last-turn-interrupted/needs-steer evidence when observable. It cannot reliably observe every private Desktop UI pause flag. It does not alter private UI flags, steal a writer or silently fork.

Local live recovery with writer available: PASS. Simulated interrupted queue/start: PASS. Desktop-owned paused-queue recovery: deferred, known v0.1 limitation; a human Steer click may be required. It is not a release blocker. Normal queue drain after idle is not unpause proof. No marketing claim of universal recovery is permitted.

Desktop-queue cancel and approval handling are not exposed through the direct-worker cancellation/clarification tools. Those tools remain limited to bridge-owned direct work.
