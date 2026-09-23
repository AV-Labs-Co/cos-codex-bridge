# npm and official MCP Registry releases

The bridge is free and runs locally. npm distributes its package; the official MCP Registry indexes metadata and does not host the server or a cloud endpoint.

## Published npm versions

| npm tag | Version | Scope |
|---|---|---|
| [`latest`](https://www.npmjs.com/package/cos-codex-bridge/v/0.1.1) | `0.1.1` | Stable Codex route |
| [`beta`](https://www.npmjs.com/package/cos-codex-bridge/v/0.2.0-beta.1) | `0.2.0-beta.1` | Codex plus Claude Code CLI preview |

Both packages were published from their matching immutable GitHub tags on 2026-09-23, with npm two-factor authentication. Their public integrity values match the locally checked archives. The stable tag passed 37 tests; the beta passed 43. Each exact archive passed a secret scan and the production dependency audit. A clean npm install and generated launcher `doctor` passed for the beta; the stable package's CLI help passed from a clean prefix.

The package includes no private configuration. The installer creates a local `config.json` with the specific project directories the owner approves. The MCP client still needs the generated stdio entry. [README installation steps](../README.md#install).

## Official MCP Registry

The Registry entry is separate from npm. Until its public API returns `io.github.av-labs-co/cos-codex-bridge`, do not claim the Registry listing is live or show a Registry badge. Publish the stable `0.1.1` descriptor first, from the `v0.1.1` tag, so the indexed version matches npm's default release. The beta descriptor remains in the beta tag and can be considered later without changing npm's stable default.

1. Confirm `npm view cos-codex-bridge dist-tags --json` still maps `latest` to `0.1.1`.
2. Check out the exact `v0.1.1` tag and run the official publisher's `validate server.json`.
3. Authenticate to the official Registry with the AV-Labs-Co GitHub organization owner account; inspect the GitHub authorization scope before approving it.
4. Run `mcp-publisher publish server.json` from that tagged checkout.
5. Read `https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.av-labs-co/cos-codex-bridge` and confirm the returned version and package. Only then add the Registry link to public copy.

The Registry's [quickstart](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/quickstart.mdx) and [authentication guide](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/authentication.mdx) define the current flow. An AV-Labs-Co organization owner can use the `io.github.av-labs-co/*` namespace. Avoid a broad permanent publishing token or a second daemon just to obtain a listing.
