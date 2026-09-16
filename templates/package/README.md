# __SCOPED__

TODO: one line on what __NAME__ does.

## The four verbs

Every package in this workspace answers to the same four script names, in the same order.

| verb | body | means |
| --- | --- | --- |
| `typecheck` | `tsc --noEmit` | the package's own sources |
| `test` | `vitest run` | the node-realm suite, once, never in watch mode |
| `build` | `tsc -p tsconfig.build.json` | the publishable artifact into `dist` |
| `receipts` | the three above in that order | the package's own full gate |

`lint` is a root verb — `pnpm lint` runs `biome check .` over every `src/**` in the workspace — so this
package keeps no `lint` script. From the repository root: `pnpm -r <verb>` fans out, `pnpm verify` runs
typecheck, build and test in the order that lets a package's tests read a sibling's `dist`.

## Releasing

`pnpm changeset` writes the release note; `pnpm release:version` consumes it. Do not hand-edit
`version` in `package.json`. A public package carries `prepack` = the common release gate
(`scripts/0_prepack.mjs`), which builds and runs `publint` before the tarball leaves.
