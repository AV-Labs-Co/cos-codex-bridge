# Changelog

## 0.1.0 — preview

Local stdio MCP and JSON CLI; exact project/task routing; durable receipts, hashes and idempotent request IDs; text artifacts; direct-worker clarification/cancellation; Desktop registration, native assignment and pin controls; explicit Desktop queue delivery and same-item recovery when the writer is available.

Free under MIT. Default execution is read-only with explicit project roots. Desktop-owned paused-queue recovery is deferred: a human Steer click may be needed. Earlier macOS Desktop field testing used Codex 0.153.4. Newer Desktop sidebar rendering is not certified; the optional legacy adapter is off by default and fails closed outside its tested version. This preview does not promise universal unattended Desktop control.

Release review includes source boundary inspection, automated tests, dependency audit and a clean-prefix installation. See docs/SECURITY-REVIEW.md for scope and limitations.
