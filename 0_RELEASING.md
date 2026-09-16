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

`release:audit` stops at the first failing package. To see every lane at once,
pack and check each one independently instead of driving the script.

Are The Types Wrong judges the published declarations against Node's own
resolution rules, so three conventions decide whether a package passes:

- Relative specifiers in source carry their emitted extension (`./0_types.js`).
  The declaration emit copies the spelling, and Node resolves a relative
  specifier literally; bundler resolution is what hides the omission locally.
- A stylesheet (or other asset) subpath needs a `types` condition beside it:

  ```json
  "./style.css": { "types": "./dist/style.css.d.ts", "default": "./dist/style.css" }
  ```

  A `.css` target is not a resolution under any export condition, so the subpath
  fails for every consumer without the declaration beside it. Declarations that
  name an asset import must not reach the published `.d.ts` either; a `tsc`
  emit keeps those imports, and `marbler` strips them after the build.
- The declaration emitter must target the path the manifest advertises. A `vite`
  build needs `vite-plugin-dts` with `entryRoot: "src"`; without it the emit adds
  a `src/` segment and the advertised `types` path stays empty. A bundled entry
  additionally needs the mirrored JavaScript beside its declarations, because a
  declaration tree resolves its siblings by name.

## Publish

```bash
pnpm release:publish --otp YOUR_2FA_CODE
```

Changesets publishes only versions absent from the registry. Each selected
package still passes through its shared `prepack` build and Publint gate.
