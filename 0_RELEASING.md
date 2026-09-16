# Releasing packages

Corepack reads the root `packageManager` field so local and CI release commands
use pnpm 11.10.0. Packages require Node 24.0.0 or newer.

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

## Versioning and internal dependencies

`changeset version` writes one `CHANGELOG.md` per bumped package. There is no root
changelog. `pnpm exec changeset status` is the gate and prints no line when every
internal range is current; a "must depend on the current version" line is a defect.

`.changeset/config.json` links `grapht-model`, `grapht`, `mmd`, and `d2`: a changeset
that names one names all four. A dependency-driven patch still moves a member alone
(`grapht` 0.1.0 to 0.1.1 while the other three stayed at 0.1.0). A package bumped only
by a range update gets no changelog entry, so a hand-written `## Unreleased` section
survives untouched.

Internal workspace dependencies use `workspace:*` in `dependencies`; pnpm rewrites it to
the real version at pack time. A hardcoded `@hafley66/*` range is a defect: `^0.0.2`
never resolves above `0.0.2` and an exact pin never moves at all, so the published
tarball ships a kernel its consumers cannot upgrade. Peer ranges are looser by design,
and `changeset version` raises them when their target bumps.

Prerelease and dev versions ship from this same pipeline, for example
`@hafley66/signals@0.1.1-dev.*` on the registry.

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
