# Package and official registry publishing

This file stages the public-package path. It does not mean the npm package or
official MCP Registry entry already exists.

Staging evidence from 2026-09-22:

- npm returned `E404` for `cos-codex-bridge`, so the unscoped name was available
  at that check. Recheck immediately before publishing because availability can
  change.
- The official Registry validation endpoint accepted `server.json` with
  `valid: true` and no issues.
- A packed tarball installed into a clean temporary prefix, exposed the expected
  executable and printed the version 0.1.0 help text.
- All 37 repository tests passed before packing.

## Release order

1. Confirm the `cos-codex-bridge` npm name is still available.
2. Merge the metadata change containing `package.json` and `server.json`.
3. From a fresh clone of `main`, run:

   ```sh
   npm ci
   npm test
   npm pack --dry-run
   ```

4. David signs in to npm with two-factor authentication. Do not store an npm
   password, one-time code or long-lived automation token in this repository.
5. Only after an explicit package-publication approval, publish version 0.1.0:

   ```sh
   npm publish --access public
   ```

6. Verify the public artifact rather than trusting the publish command alone:

   ```sh
   npm view cos-codex-bridge@0.1.0 name version dist.integrity repository --json
   npx --yes cos-codex-bridge@0.1.0 --help
   ```

7. Validate and publish `server.json` with the official `mcp-publisher` tool.
   GitHub authentication must use the AV-Labs-Co namespace owner and may open a
   browser authorization step.
8. Read the resulting entry back from the official Registry before adding an
   official-registry badge or changing the README installation path.

## Configuration boundary

The package does not grant access to any directory by default. Real use still
requires the local installer to create a private configuration file with an
explicit project-root allowlist. The registry metadata passes that file through
`COS_BRIDGE_CONFIG`; it does not embed David's paths or create a hosted bridge.

## Version discipline

The version in `package.json`, `server.json`, the MCP server info response and
the release tag must match. npm versions are immutable. If version 0.1.0 is ever
published incorrectly, fix the problem in a new patch release rather than
attempting to overwrite it.
