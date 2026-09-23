# npm and official MCP Registry releases

The bridge is free and runs locally. npm distributes its package; the official MCP Registry indexes metadata and does not host the server or a cloud endpoint.

## Published npm versions

| npm tag | Version | Scope |
|---|---|---|
| [`latest`](https://www.npmjs.com/package/cos-codex-bridge/v/0.1.3) | `0.1.3` | Stable Codex route |
| [`beta`](https://www.npmjs.com/package/cos-codex-bridge/v/0.2.0-beta.1) | `0.2.0-beta.1` | Codex plus Claude Code CLI preview |

The stable `0.1.3` update and the beta were published from matching GitHub tags on 2026-09-23, with npm two-factor authentication. The stable release passed 38 tests; the beta passed 43. Exact archives passed a secret scan and the production dependency audit. Clean npm installation and generated-launcher `doctor` passed for each route.

The package includes no private configuration. The installer creates a local `config.json` with the specific project directories the owner approves. The MCP client still needs the generated stdio entry. [README installation steps](../README.md#install).

## Official MCP Registry

The Registry entry is separate from npm. Until its public API returns `io.github.AV-Labs-Co/cos-codex-bridge`, do not claim the Registry listing is live or show a Registry badge. The Registry's GitHub Actions identity permits the **case-sensitive** `io.github.AV-Labs-Co/*` namespace. Stable `0.1.2` corrected the descriptor and npm `mcpName` capitalization. Stable `0.1.3` also corrects the runtime's displayed version. MCP tool behavior is unchanged. The `0.1.1` Registry attempt failed because its lowercase name did not match that identity.

1. Confirm `npm view cos-codex-bridge dist-tags --json` maps `latest` to `0.1.3`.
2. On the main branch, manually run `Publish stable MCP Registry entry` from GitHub Actions. Its read-only checkout uses the exact `v0.1.3` commit and confirms that the descriptor matches the already published npm metadata.
3. The workflow downloads the checksum-verified official publisher, validates the descriptor, authenticates through GitHub Actions OIDC, and publishes. It stores no registry publishing token.
4. Read `https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.AV-Labs-Co/cos-codex-bridge` and confirm the returned version and package. Only then add a Registry link to public copy. The beta descriptor can be considered later without changing npm's stable default.

The Registry's [GitHub Actions publishing guide](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/github-actions.mdx) defines this flow. Avoid a broad permanent publishing token or a second daemon just to obtain a listing.
