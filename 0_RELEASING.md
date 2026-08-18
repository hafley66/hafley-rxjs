# Releasing packages

Every public workspace package uses the same `prepack` command. The command
builds the package and runs Publint against the exact npm file allowlist. A
publish stops before registry mutation when build output or declared exports
are missing.

## Change and version

```bash
pnpm changeset
pnpm release:version
```

Changesets updates package versions and internal workspace dependency ranges.

## Verify

```bash
pnpm release:check
pnpm release:audit
```

`release:check` verifies that every public package has the shared lifecycle,
version, build command, and explicit `files` allowlist. `release:audit` builds
and packs every public package, runs Publint, and checks each tarball with Are
The Types Wrong under the repository's ESM-only profile.

## Publish

```bash
pnpm release:publish --otp YOUR_2FA_CODE
```

Changesets publishes only versions absent from the registry. Each selected
package still passes through its shared `prepack` build and Publint gate.
