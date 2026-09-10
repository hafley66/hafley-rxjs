# signal-grid

A headless data grid whose rows and columns are one type, `Axis<K, T>` (`src/0_types.ts:40`),
derived through five pure operators into signals. Every claim names a file line, a test, or a
command that printed the number.

## Four claims and their receipts

| claim | receipt |
| --- | --- |
| One operator flattens both forests. `flattenAxis` runs over the row forest and over the column forest, same function, same signature. | `src/1_axis.ts:361`, called at `src/8_grid.ts:327` for rows and `src/8_grid.ts:370` for columns |
| `state.orientation` swaps which axis scrolls, and no branch on orientation exists in `src/`. Two lookup tables carry it. | `grep -rnE "if *\(.*orientation\|orientation *===\|orientation *!==" src/` matches nothing and exits 1. The tables are `src/12_transpose.ts:27` and `src/12_transpose.ts:32` |
| A 2 by 3 span transposes to 3 by 2, and the set of cells it covers swaps with it. | `src/12_transpose.test.ts:190`, cases at `:194`, `:203`, `:212` |
| No layout algorithm. `trackList` emits one `grid-template-columns` value and the browser distributes the width. | `src/4_slice.ts:247`; the pixel solver it replaced is deleted, `docs/5_tests.md:246`, `src/8_grid.ts:426` |

## Counts, measured on every ship

| number | command |
| --- | --- |
| 0 failed of {{stats.tests.unit}} unit tests across {{stats.source.testFiles}} files | `npx vitest run` |
| 15 browser tests, 2 files, 0 failed | `npx vitest run -c vitest.e2e.config.ts` |
| {{parity.features}} features tracked, {{parity.implemented}} implemented, {{parity.declaredOnly}} declared as types nothing runs | `node scripts/parity.mjs` |
| {{stats.bundle.library.totalBytes}} B of published output, {{stats.bundle.library.totalGzipBytes}} B gzipped, across {{stats.bundle.library.fileCount}} files | `site/stats.json`, `bundle.library` |

The matrix reports {{parity.implemented}} rather than 30 because a `@feature` tag sitting on a declaration with no
function and no call inside it fails the run: `scripts/parity.mjs:40` decides what carries code,
`:208` fails on the ones that do not. Nine ids carry `@feature-declared` instead and print in their
own column. A feature listed as cut fails the same run if it is ever tagged (`scripts/parity.mjs:240`).

## Measured against @tanstack/table-core 9.1.0, losses included

| operation | signal-grid | table-core | ratio |
| --- | ---: | ---: | ---: |
| expand a 124,800-node tree, 10 percent open | 0.214 ms | 0.651 ms | 3.04x ours |
| read the derived list with no write | 0.000137 ms | 0.000454 ms | 3.31x ours |
| sort 100k rows on one numeric key | 161.5 ms | 188.6 ms | 1.17x ours |
| change the sort key and re-derive | 218.1 ms | 227.9 ms | 1.04x ours |
| group 100k rows on one key | 45.0 ms | 32.9 ms | 1.37x theirs |
| change a width and re-derive | 0.0126 ms | 0.00181 ms | 6.95x theirs |

`bench/README.md:246`, method at `bench/README.md:53`, machine at `:70`. Retained memory over 100k rows
is 46 B per row against 786 B (`bench/README.md:318`, `:323`).

The last row was two causes in `@hafley66/signals`, neither of them in this package
(`bench/README.md:238`): a write to one branch of the state tree re-emitted on every other branch's
selector, so a `colWidth` write re-sorted the whole row pipeline. The fix landed and one `colWidth`
write at 100,000 rows now costs 0.0126 ms (`.changeset/signals-distinct.md:7`, held by
`packages/signals/src/4_assumptions.test.ts:19`).

## Not built, by decision

Filtering, quick filter, filter logic, aggregation, inline editing, column type systems, pivoting.
Each keeps a `FeatureId` so the gap is visible, and each carries a written reason at
`scripts/parity.mjs:90`. `filterAxis` exists (`src/1_axis.ts:225`) and no stage of the view chain
calls it.

Absent and not yet decided: column virtualization, column autosize, clipboard, aria roles,
localization, export, undo (`docs/1_parity.md`, "Not decided yet"). The transpose reaches the model
and not the rendered cells: under `orientation: "columns"` the renderer builds the frame and
`slots.cell` is never called, measured on the site's "The seat table" page. Read that next.
