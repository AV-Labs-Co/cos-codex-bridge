# Package and official MCP Registry publishing

Status: **staged, not published**. GitHub hosts the public source and the earlier
v0.1.0 preview. The npm package and official Registry listing are separate
publications; neither exists merely because this file or `server.json` is in GitHub.

## Why the next package is 0.1.1

The existing GitHub `v0.1.0` tag points to the original preview snapshot. The
package metadata and Registry descriptor were merged later. Version 0.1.1 aligns
the code, npm package, Registry descriptor and a new GitHub tag. Do not move the
old tag or publish a package from a commit different from its matching tag.

## Checks already staged

On 2026-09-22, a fresh clone of public main passed 37 tests and `npm pack
--dry-run`; its 31-file package scan found no private home paths or credentials.
The official MCP Registry publisher v1.8.1 was verified against the release
checksum and accepted `server.json`. Repeat the package and Registry validation
on the 0.1.1 commit before publishing. The unscoped npm name was unclaimed at
that check; recheck immediately before publication.

## Release order

1. Merge the 0.1.1 version PR only after macOS and Ubuntu CI pass. Confirm the
   merged commit is the intended source.
2. Create `v0.1.1` at that exact commit. Do not retag `v0.1.0`.
3. From a clean checkout of `v0.1.1`, run `npm ci`, `npm test`, `npm audit
   --omit=dev`, `npm pack --dry-run` and `mcp-publisher validate server.json`.
   Check the package contents again for private paths and secrets.
4. David signs in to npm and completes npm's security challenge. Interactive
   package creation/publishing requires two-factor authentication; npm currently
   documents browser security keys such as Touch ID. Use the methods the account
   actually offers. Do not store passwords,
   one-time codes or publishing tokens in the repository.
5. Recheck `npm view cos-codex-bridge@0.1.1` and package-name ownership. From
   the tagged checkout, publish once with `npm publish --access public`.
6. Read the public package back with `npm view cos-codex-bridge@0.1.1 name
   version dist.integrity repository --json` and run its `--help` command from
   a clean prefix. Do not claim success from the publish command alone.
7. Run `mcp-publisher login github` with the AV-Labs-Co GitHub identity, then
   `mcp-publisher publish server.json`. Read the official Registry entry back
   before displaying a Registry badge or claiming the listing is live.
8. Publish GitHub release `v0.1.1` with a link to the verified npm package and
   the known Desktop writer-lock limitation. Keep the v0.1.0 preview intact.

The owner has approved npm and Registry publication. Account sign-in and the
security challenge are the remaining human actions; those steps cannot be
completed on the owner's behalf from an unauthenticated CLI.

## Configuration boundary

The npm package grants no directory access by default. Real use still requires
an installer-created private `config.json` with explicit approved project roots.
Registry metadata passes the path through `COS_BRIDGE_CONFIG`; it embeds no
personal paths and does not create a hosted bridge.

## After the first publication

Consider npm trusted publishing for future releases, using a tightly scoped
GitHub workflow and npm's official setup. Do not enable it silently or use a
bypass-2FA token to get around the owner's first account verification.
