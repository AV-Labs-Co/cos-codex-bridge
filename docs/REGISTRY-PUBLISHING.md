# npm and official MCP Registry releases

The bridge is free and runs locally. npm distributes its package; the official MCP Registry indexes metadata and does not host the server or a cloud endpoint.

## Published npm versions

| npm tag | Version | Scope |
|---|---|---|
| [`latest`](https://www.npmjs.com/package/cos-codex-bridge/v/0.1.2) | `0.1.2` | Stable Codex route |
| [`beta`](https://www.npmjs.com/package/cos-codex-bridge/v/0.2.0-beta.1) | `0.2.0-beta.1` | Codex plus Claude Code CLI preview |

The stable `0.1.2` update and the beta were published from matching GitHub tags on 2026-09-23, with npm two-factor authentication. The stable release passed 37 tests; the beta passed 43. Exact archives passed a secret scan and the production dependency audit. Clean npm installation and generated-launcher `doctor` passed for each route.

The package includes no private configuration. The installer creates a local `config.json` with the specific project directories the owner approves. The MCP client still needs the generated stdio entry. [README installation steps](../README.md#install).

## Official MCP Registry

The [official Registry record](https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.AV-Labs-Co%2Fcos-codex-bridge) is live. The public API returned `io.github.AV-Labs-Co/cos-codex-bridge`, version `0.1.2`, npm package `cos-codex-bridge@0.1.2` on 2026-09-23. [GitHub Actions run 35862746477](https://github.com/AV-Labs-Co/cos-codex-bridge/actions/runs/35862746477) completed every publish step. This is a metadata listing, not a hosted endpoint.

The Registry's GitHub Actions identity permits the **case-sensitive** `io.github.AV-Labs-Co/*` namespace. Stable `0.1.2` corrected the descriptor and npm `mcpName` capitalization; MCP tool behavior is unchanged. Its doctor still displays the runtime label `0.1.1`. The earlier `0.1.1` Registry attempt failed because its lowercase name did not match that identity.

For a future stable update:

1. Publish and verify the matching npm package first.
2. Update the manual `Publish stable MCP Registry entry` workflow to check out the exact release commit and verify the same version and `mcpName` in npm.
3. Run the workflow from main. It downloads the checksum-verified official publisher, validates the descriptor, authenticates through GitHub Actions OIDC, and publishes. It stores no registry publishing token.
4. Confirm the new version and package in the public Registry API before changing public copy. The beta descriptor can be considered later without changing npm's stable default.

The Registry's [GitHub Actions publishing guide](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/github-actions.mdx) defines this flow. Avoid a broad permanent publishing token or a second daemon just to obtain a listing.
