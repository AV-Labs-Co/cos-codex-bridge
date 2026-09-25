# Try CoS Codex Bridge without an account

Your Chief of Staff can hand a complete prompt to Codex, check its result and continue the same task. This first check demonstrates the local receipt workflow without calling a model, signing into Codex or changing a real project. It is a simulation, not proof that your MCP client or Codex is connected.

## 1. Run the stable demo

Requires Node.js 22+ and npm. These commands are for macOS or Linux in a POSIX shell. They install the pinned stable package in a fresh temporary directory; they do not change your existing bridge or client configuration. The npm download needs internet access.

```sh
bridge_demo_dir="$(mktemp -d)"
npm install --prefix "$bridge_demo_dir" cos-codex-bridge@0.1.4
node "$bridge_demo_dir/node_modules/cos-codex-bridge/scripts/demo.mjs"
```

Look for `DEMO ONLY` and a final receipt containing:

```json
{
  "mode": "demo",
  "state": "completed",
  "promptBytes": 79
}
```

The receipt also contains `promptSha256` and `payloadSha256`, which identify the submitted bytes. Its first state may be `queued`; the later `completed` result is the one to check. The demo prints its temporary data location and makes no model call. It leaves its temporary package and demo files for inspection.

Verified on macOS from a clean installation of the published 0.1.4 npm package on 2026-09-25. A successful terminal demo does not certify every MCP client.

## 2. Connect your local Chief of Staff

Follow [the stable installation instructions](../README.md#install) using a persistent package directory and a specific project folder you approve. The generated launcher points at that package, so keep it in place.

1. Run the installer with that project root. Keep the read-only default.
2. Run the generated launcher's `doctor` command. Confirm the root and that the relevant locally authenticated CLI is available.
3. Add the generated `mcp-client.json` entry to your local client's existing MCP settings. Preserve its other servers.
4. Restart or reload that client and check that it exposes `bridge_doctor`, `bridge_submit` and `bridge_receipt`.

A cloud-only chat cannot launch this local stdio server. A directory listing is not a hosted endpoint. If the client cannot see your local filesystem or launch a command, stop here and use a local MCP-capable client.

## 3. Check one real handoff

Use a disposable folder inside the root you approved. Ask your Chief of Staff:

> In this approved test folder, send Codex the prompt “Reply BRIDGE_READY without modifying any files.” Use a stable requestId, wait for its receipt, and show me the result. Then follow up in the same task asking what marker I requested. Do not publish, deploy or change permissions.

Confirm the receipt completes, the reply matches, and the follow-up keeps the same task ID. This part uses your existing Codex account and model access. Desktop sidebar visibility is a separate check. A busy Desktop-owned task may still need a human Steer click; see [the known limitation](../README.md#busy-tasks-steering-and-interruption-recovery).

Stable 0.1.4 supports Codex. For the optional Claude Code CLI beta, follow [Claude setup](CLAUDE.md). Regular Claude chat Projects are not a published capability of these releases.

## 4. Tell us what happened

[Report your installation result](https://github.com/AV-Labs-Co/cos-codex-bridge/issues/new?template=installation.yml): OS, package version, MCP client, furthest successful step and the first error code, if any. Successful installs are useful too. Do not attach credentials, private prompts, full receipts or personal paths.

If the bridge is useful, star [the repository](https://github.com/AV-Labs-Co/cos-codex-bridge) to follow its development. Free and MIT licensed.
