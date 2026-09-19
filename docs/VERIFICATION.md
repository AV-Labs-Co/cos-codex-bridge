# Verification

Core owner field tests on macOS: project registration, automatic assignment, sidebar listing and pinning, exact prompt/completion, follow-up context, idempotency conflict, cross-project/allowlist rejection, Unicode artifacts and size limits, cancellation and clarification passed. Real Desktop quit/reopen durability passed per the owner's field report.

Native queue recovery with writer available passed a live same-task test. Unit tests cover interrupted recovery, blocked writer, no false delivery, lost acknowledgement, scope checks and policy consent. Desktop-owned recovery is deferred for v0.1 and is not claimed as supported. The prior field PASS was retracted because the queue drained after natural completion.

A receipt confirms protocol state; visual rendering requires separate observation. A completed turn confirms execution ended; it does not independently verify its work. No paid-demand, universal-client, fresh-human-account, cloud or ordinary ChatGPT claim.

Run `npm ci && npm test`. Clean-prefix install uses demo mode to avoid credentials; a fresh Codex account is not simulated by that check.


## Final runtime version check

The installed Codex executable now reports 0.155.0-alpha.9.2. Earlier Desktop field proof used 0.153.4. The legacy adapter remains gated to 0.153.4 and will fail closed on the new runtime; native membership and legacy rendering must remain separately reported. Doctor now reports desktopLegacyAssignmentSupported independently of the enabled flag. Newer Desktop rendering is not certified in this preview. No new disposable Desktop projects are needed to publish the core with that explicit limitation.

Automated regression is rerun for each release; see the release security review for the current count. Queue adoption preserves the existing CLI client message ID and rejects missing queue items without creating a new prompt.
