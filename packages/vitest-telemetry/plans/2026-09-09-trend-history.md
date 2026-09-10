# Trend history: per-node run series, sparkline column, runs section

Status: plan only. No code written.
Board: `plans/2026-09-09-trend-history.d2` (3222x677, 14 shapes).

## TOC

1. [What breaks if this is wrong](#1-what-breaks-if-this-is-wrong)
2. [Where history lives](#2-where-history-lives)
3. [Type signatures](#3-type-signatures)
4. [Identity: the node key](#4-identity-the-node-key)
5. [Memory and cpu attribution](#5-memory-and-cpu-attribution)
6. [Read/write sequence of `vitest-telemetry report`](#6-readwrite-sequence-of-vitest-telemetry-report)
7. [Information architecture: one column, one section, one popover](#7-information-architecture-one-column-one-section-one-popover)
8. [Build vs buy: the chart](#8-build-vs-buy-the-chart)
9. [Test staging](#9-test-staging)
10. [Case table](#10-case-table)
11. [Untested and why](#11-untested-and-why)
12. [Order of work](#12-order-of-work)

---

## 1. What breaks if this is wrong

| break | today's detector | cost |
| --- | --- | --- |
| a test goes flaky over 20 runs, each run shows green-then-red once | none | flake found by a human noticing twice |
| a test's duration triples over a month | none | suite wall time drifts with no owner |
| a worker's heap climbs run over run | none | OOM in CI, first seen as a timeout |
| `rm -rf out` in `pnpm test` eats the run archive | n/a (no archive exists) | every trend resets on every run |
| a renamed test silently starts a new series | n/a | trend reads as "new test", never as "renamed" |
| `src/report-app/**/*.test.ts` (7 files) is in no vitest `include` | none | the unit layer this plan adds would also never run |

Last item is present today: `fixtures/vitest.config.ts` includes only `fixtures/tests/*`, `vitest.e2e.config.ts` includes only `tests/report*.e2e.test.ts`. `model.test.ts`, `adapter/navTree.test.ts`, and `lib/*.test.ts` (5) execute in no configured project.

## 2. Where history lives

`out/` is deleted by the package's own `test` script (`rm -rf out`). History cannot live there.

```
<repoRoot>/.vitest-telemetry/
  runs.ndjson              # append one RunSummary line per run
  nodes/<runId>.ndjson     # one NodeSample line per node key, one file per run
```

Two files, not one. Pruning a run is `unlink nodes/<runId>.ndjson` plus one rewrite of `runs.ndjson` (small, one line per run), instead of rewriting a multi-megabyte combined file.

Path is a plugin option `history: { dir, keep, embed }`, default `{ dir: '.vitest-telemetry', keep: 50, embed: 20 }`. `keep` bounds disk, `embed` bounds the bytes inlined into `report.html`.

## 3. Type signatures

```ts
// src/history/keys.ts
export type NodeKind = 'shard' | 'file' | 'suite' | 'test'
export function nodeKey(kind: NodeKind, e: Pick<Event, 'shard' | 'file' | 'suitePath' | 'test'>): string
// shard:<n> | file:<rel> | suite:<rel>::<a > b> | test:<rel>::<a > b > name>

// src/history/rollup.ts
export interface NodeSample {
  key: string; kind: NodeKind; label: string
  status: 'pass' | 'fail' | 'skip' | 'none'
  durationMs: number       // wall span of the node
  events: number           // rows attributed to it
  peakHeapMb: number | null // null when no metric point fell inside the node's window
  cpuPct: number | null
  heapSamples: number      // how many points backed peakHeapMb; 0 means null above
}
export interface RunSummary {
  runId: string            // `${startedAtCompactIso}-${sha7 ?? 'nogit'}-${rand4}`
  startedAt: number; durationMs: number
  git: { sha: string | null; branch: string | null; dirty: boolean }
  totals: { pass: number; fail: number; skip: number }
}
export function rollup(events: Event[]): { run: RunSummary; nodes: NodeSample[] }
//   group events by (kind, key); status from the junit verdict rows already in the timeline;
//   durationMs = max(end) - min(t) over the group; peakHeapMb per §5.

// src/history/store.ts
export function appendRun(dir: string, run: RunSummary, nodes: NodeSample[]): void
export function pruneHistory(dir: string, keep: number): string[]   // returns removed runIds
export function readHistory(dir: string, limit: number): { runs: RunSummary[]; nodes: Map<string, NodeSample[]> }

// src/history/trend.ts
export interface Trend {
  key: string; kind: NodeKind
  durationMs: (number | null)[]     // index-aligned to TrendSet.runs
  status: ('pass' | 'fail' | 'skip' | null)[]
  peakHeapMb: (number | null)[]
  events: (number | null)[]
}
export interface TrendSet { runs: RunSummary[]; byKey: Record<string, Trend> }
export function buildTrends(runs: RunSummary[], nodes: Map<string, NodeSample[]>, limit: number): TrendSet
//   runs sorted ascending by startedAt, truncated to the newest `limit`;
//   a key absent from a run gets null at that index, never a shifted value.

// packages/report-shell/src/components/Sparkline.tsx
export interface SparklineProps {
  values: (number | null)[]
  marks?: ('pass' | 'fail' | 'skip' | null)[]   // per-point dot colour
  width?: number; height?: number               // default 96 x 16
  baseline?: 'zero' | 'min'                     // default 'zero'
  label?: string                                // aria-label / title
}
export function Sparkline(props: SparklineProps): ReactNode
```

Lifetimes:

| type | created | dies |
| --- | --- | --- |
| `HistoryStore` calls | inside `runReport`, one per CLI invocation | function return; no handle held |
| `TrendSet` | once in `renderReport`, serialized into the HTML | page load parses it back, immutable thereafter |
| `Signal<TrendSet>` in `model.ts` | `createModel`, plain `Signal`, not URL-backed | page unload |
| `Sparkline` SVG | per grid row render, no subscriptions | row unmount |

## 4. Identity: the node key

| kind | key | uniqueness condition |
| --- | --- | --- |
| shard | `shard:1` | shard label is stable per config; a shard-count change makes new keys, correctly |
| file | `file:packages/x/src/a.test.ts` | repo-relative, POSIX separators |
| suite | `suite:<file>::<describe > describe>` | suitePath joined with ` > ` |
| test | `test:<file>::<suitePath > name>` | duplicate names inside one file get `#2`, `#3` in first-seen order |

A rename is a new key. No fuzzy matching: a silently-rebased series is worse than a visible restart. The Runs section labels a series with fewer than 3 points "new since &lt;date&gt;".

## 5. Memory and cpu attribution

`otel.node.ts:64` samples `process.memory`, `process.cpu`, `system.memory`, `system.cpu` on a 500 ms reader, per worker pid. Metric points carry a pid, not a test.

```
peakHeapMb(node) = max { p.value | p.name === 'process.memory.usage'
                                && p.pid === node.pid
                                && node.t <= p.t <= node.t + node.durationMs }
```

Consequence to state in the UI, not hide: a test shorter than the 500 ms sample interval usually captures **zero** points, so `peakHeapMb` is `null` and the memory sparkline draws a gap. The `heapSamples` field carries the count so the popover can say `2 samples` instead of implying a measurement. File-level and shard-level nodes are long enough to always have points.

## 6. Read/write sequence of `vitest-telemetry report`

```
step 0  buildTimeline(out)                 -> events: Event[]        (unchanged today)
step 1  rollup(events)                     -> { run, nodes }         run.runId minted here
step 2  appendRun(dir, run, nodes)         -> runs.ndjson += 1 line, nodes/<runId>.ndjson written
step 3  pruneHistory(dir, keep=50)         -> unlink 0..k node files, rewrite runs.ndjson
step 4  readHistory(dir, limit=20)         -> runs[20], nodes map     (includes the run from step 2)
step 5  buildTrends(runs, nodes, 20)       -> trendSet
step 6  renderReport(events, trendSet)     -> out/report.html
```

Step 2 before step 4 on purpose: the current run is the rightmost point of every sparkline in the report it just produced.

Concurrency: only `cli.js report` writes, one process per run, after every shard has exited. No lock needed. A parallel `report` on the same dir is out of scope and documented as unsupported.

## 7. Information architecture: one column, one section, one popover

No new top-level nav. Three insertion points, all existing surfaces:

| surface | file | change |
| --- | --- | --- |
| nav grid column `trend` | `report-app/components/NavColumns.tsx` | one `TreeColumn` after `duration`, `size: 104`, cell = `<Sparkline values={trend.durationMs} marks={trend.status} />`; `sortValue` = slope of the last 5 points, so "getting slower" sorts to the top |
| hover popover | `report-shell/src/components/Popover.tsx` (existing) | run-by-run table: run date, sha7, duration, delta vs previous, status dot, heap, sample count |
| runs section | `report-shell/src/components/Section.tsx` (existing) | one section in the detail panel for the selected node: duration line + heap line on one x axis of run index, failures marked |

The nav column is the whole of the "at a glance" story; the section is the only new panel and it lives inside the panel stack that already exists. Nothing moves.

## 8. Build vs buy: the chart

Two consumers with different shapes: ~200 row cells at 96x16 px, and one 600x180 panel chart.

| candidate | size | fit for the 200 row cells | fit for the panel |
| --- | --- | --- | --- |
| `uPlot` 1.6 | 47 kB min / ~16 kB gz, zero deps | one canvas + one `uPlot` instance per row; 200 canvases on a virtualized tree is the wrong unit of work | strong: crosshair, tooltips, dual y axis, sub-ms redraw at 20 points |
| `@visx/sparkline` | pulls `d3-shape` + `d3-array`, ~30 kB gz | React SVG per row, works; adds two d3 packages to a bundle that inlines everything into one HTML file | weak: no interaction layer, would need `@visx/axis`, `@visx/tooltip` on top |
| `d3-shape` alone | ~12 kB gz | builds the `d` string, we own the `<path>`; curve + scale for free | usable, but axis/tooltip still hand-written |
| `react-sparklines` | 3.5 kB | last publish 2019, React 15/16 peer, unmaintained against React 19 | reject |
| `chart.js` + `react-chartjs-2` | ~70 kB gz | canvas per row, same objection as uPlot, heavier | works, heavier than uPlot for less control |
| own `<polyline>` component | 0 | ~35 lines: min/max scale, null gaps, per-point dot; inherits `currentColor` and grid theming | panel needs axis + hover written by hand, ~150 more lines |

Decision fork, one call needed:

- **A (recommended).** Own `Sparkline` for the row cells, `uPlot` for the runs panel. The 200-instance path stays pure SVG with no runtime; the one interactive chart buys crosshair/tooltip/zoom instead of hand-rolling them. Cost: one new dep, +16 kB gz in a single-file HTML that already inlines pixi via `@hafley66/marbler`.
- **B.** Own both. Zero deps, `scripts/1_checkNoExternal.mjs` stays trivially satisfied, and the panel's hover/axis code is ours to maintain (~150 lines, plus the tests for them).
- **C.** `uPlot` for both. One engine, but 200 canvas contexts inside a virtualized tree is a per-scroll cost that the SVG path does not have.

`Sparkline` lands in `@hafley66/report-shell` either way, since `boop-adapters` has the same report-app shape and will want it.

## 9. Test staging

Seam: the pipeline crosses four processes (shards, CLI, browser page, playwright). Cut it at three places so no layer needs a real multi-run history to exist.

| layer | runner | config | what it owns |
| --- | --- | --- | --- |
| L1 unit, node | `vitest run -c vitest.unit.config.ts` (**new**, `include: ['src/**/*.test.ts']`) | new file | `nodeKey`, `rollup`, `appendRun`/`prune`/`readHistory`, `buildTrends`, the memory window |
| L2 unit, browser | `report-shell` `vitest.browser.config.ts` (exists) | existing | `Sparkline` geometry + screenshot, against `src/components/__screenshots__` |
| L3 e2e | `vitest.e2e.config.ts` (exists) | existing | trend column renders, popover opens, section draws, from a committed history fixture |

The new `vitest.unit.config.ts` also picks up the 7 orphaned test files listed in §1. That is a side effect worth having and belongs in step S1 of §12, not later.

Fixture, committed, deterministic, generated once by `scripts/2_makeHistoryFixture.mjs --seed 7`:

```
fixtures/history/runs.ndjson          12 runs, startedAt 2026-08-28..2026-09-08, fixed shas
fixtures/history/nodes/<runId>.ndjson 12 files
```

Contents chosen so every UI state has a row that produces it:

| fixture node | shape over 12 runs | what it proves |
| --- | --- | --- |
| `test:a.test.ts::adds` | flat 40 ms, all pass | the boring baseline reads as flat, not as noise |
| `test:a.test.ts::flaky` | pass/fail alternating | fail marks land on the right x index |
| `test:b.test.ts::slow ramp` | 20 ms -> 240 ms linear | slope sort puts it first |
| `test:b.test.ts::added late` | absent runs 1-6, present 7-12 | leading nulls draw as a gap, not as zero |
| `test:c.test.ts::deleted` | present 1-4, absent after | trailing nulls, and the row still exists in history but not in the current nav |
| `test:c.test.ts::sub-500ms` | `peakHeapMb: null`, `heapSamples: 0` every run | the memory sparkline is empty and the popover says `no samples` |
| `file:c.test.ts` | heap 180 -> 420 MB | the file-level memory trend is the one that is always populated |
| `shard:1`, `shard:2` | duration diverging | shard skew is visible at the top of the tree |

`tests/e2eHelpers.ts` gains `HISTORY_FIXTURE` and the e2e build points `report` at `fixtures/history` instead of `.vitest-telemetry`, so L3 never depends on the developer's own run count.

## 10. Case table

| # | layer | case | input | expected | why this case exists |
| --- | --- | --- | --- | --- | --- |
| 1 | L1 | key for a nested suite | file `a.ts`, suitePath `['x','y']`, test `z` | `test:a.ts::x > y > z` | the key is the join point of every layer; a separator change silently forks every series |
| 2 | L1 | duplicate test names in one file | two `it('same')` | `...::same`, `...::same#2` | vitest permits it; without the suffix two rows collapse into one trend |
| 3 | L1 | rollup status from junit rows | verdict rows fail + pass | node status `fail` | status must come from the verdict, not from span error levels, which also fire on logged errors |
| 4 | L1 | heap window, no points | node 80 ms between samples | `peakHeapMb: null`, `heapSamples: 0` | this is the common case for unit tests; a `0` here would draw a floor and read as "no memory used" |
| 5 | L1 | heap window, 3 points | node 1600 ms | max of the three, `heapSamples: 3` | proves max, not last, and proves the pid filter |
| 6 | L1 | heap window, other pid | points from a sibling worker inside the window | excluded | shards run concurrently; without the pid filter every test inherits its neighbour's heap |
| 7 | L1 | append then read | 1 run appended to an empty dir | `readHistory` returns it, nodes map has every key | the step 2 -> step 4 ordering of §6 |
| 8 | L1 | prune keeps newest | 55 runs, `keep: 50` | 5 oldest runIds returned, 5 node files gone, `runs.ndjson` has 50 lines | unbounded growth is the default failure of an append-only store |
| 9 | L1 | prune is idempotent | run it twice | second call returns `[]`, no throw | `report` runs on every test invocation; a throw here breaks the report |
| 10 | L1 | corrupt line tolerated | a truncated last line (killed mid-write) | that line skipped, the rest parse, one warning | an interrupted run must not brick the archive permanently |
| 11 | L1 | trend alignment with a gap | key present in runs 1,2,4 | `[v1, v2, null, v4]` | the whole point: index 3 must be a hole, not a left shift that misdates every later point |
| 12 | L1 | trend limit | 40 runs, `limit: 20` | 20 newest, ascending, `runs.length === 20` | bounds the bytes inlined into `report.html` |
| 13 | L2 | flat series | `[40,40,40,40]` | horizontal line at mid-height, no `NaN` in `d` | zero range is a division by zero in every naive scale |
| 14 | L2 | single point | `[40]` | one dot, no line, no throw | a test on its first ever run hits this on day one |
| 15 | L2 | empty series | `[]` | renders nothing, no throw | a node with no history (renamed) still gets a cell |
| 16 | L2 | nulls draw gaps | `[10,null,30]` | two segments, not one line through the gap | interpolating across a missing run invents data |
| 17 | L2 | fail marks | `marks: ['pass','fail','pass']` | middle dot carries the fail class | the flake story is the marks, not the line |
| 18 | L2 | screenshot | the 6 fixture shapes in one strip | matches `__screenshots__/sparkline.png` | geometry assertions pass while the thing looks wrong |
| 19 | L3 | column present | fixture report | every `[data-testid=tree-row]` has `[data-testid=trend-cell]` | the column exists at every tree depth, not only on leaves |
| 20 | L3 | slope sort | click `trend` header | `slow ramp` first | the sort key is a derived value, the one place a column can silently sort by string |
| 21 | L3 | popover contents | hover `flaky` cell | 12 rows, 6 with a fail dot, sha7 per row | proves the run axis reached the DOM in order |
| 22 | L3 | no-sample memory copy | hover `sub-500ms` | reads `no samples`, not `0 MB` | §5's caveat has to survive into the pixels |
| 23 | L3 | section for selection | select `slow ramp` | runs section shows 12 points, y axis in ms | the only new panel |
| 24 | L3 | no page errors | whole flow | `pageErrors` empty | the existing e2e discipline in `e2eHelpers.ts:22` |

## 11. Untested and why

| not tested | why |
| --- | --- |
| real multi-run drift on this machine | needs 12 real `pnpm test` runs, ~11 minutes; the fixture encodes the same shapes deterministically |
| concurrent `report` processes on one history dir | documented as unsupported in §6; a lock is a different plan |
| cross-machine history merge (CI + laptop) | runIds are unique but the `git.sha` axis is not ordered across machines; out of scope until there is a CI writer |
| `system.memory` / `system.cpu` series | host-wide, not per node; they belong to a machine-health panel, not a per-test trend |
| uPlot's own rendering | vendor code; L3 case 23 asserts our data reached it |
| pruning under a full disk | node's `writeFileSync` error path, not ours |

## 12. Order of work

| step | lands | gate |
| --- | --- | --- |
| S0 | `scripts/2_makeHistoryFixture.mjs` + `fixtures/history/**` committed | fixture regenerates byte-identical from `--seed 7` |
| S1 | `vitest.unit.config.ts` + the 7 orphaned test files now running | `pnpm test:unit` green, count of executed files reported |
| S2 | `src/history/{keys,rollup,store,trend}.ts` + L1 cases 1-12 | `pnpm test:unit` green |
| S3 | `report-shell` `Sparkline` + L2 cases 13-18 | `pnpm --filter @hafley66/report-shell test:browser` green, screenshot committed |
| S4 | `cli.ts` step 2-5 wiring, `renderReport(events, trendSet)`, trend inlined | `node dist/cli.js report` writes `.vitest-telemetry/`, `scripts/1_checkNoExternal.mjs` still passes |
| S5 | `NavColumns.tsx` trend column + popover, L3 cases 19-22, 24 | `pnpm test:e2e` green |
| S6 | runs section (chart per §8 decision), L3 case 23 | `pnpm receipts` green end to end |

S3 needs the §8 decision only for S6; the row cell is the own-component path in every option.
