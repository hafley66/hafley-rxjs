# @hafley66/signal-grid

A headless data grid whose rows and columns are both `Axis<K, T>` ordered forests
(`Axis` in `src/0_types.ts`), derived through pure operators into signals, with DOM events arriving as
one typed action bus and an optional plain-DOM renderer.

## Contents

1. [Status](#status)
2. [Install and smallest grid](#install-and-smallest-grid)
3. [The one idea](#the-one-idea)
4. [Constructor inputs](#constructor-inputs)
5. [Constructor outputs](#constructor-outputs)
6. [Not built](#not-built)
7. [Docs](#docs)

## Status

465 unit tests across 17 files (`pnpm -F @hafley66/signal-grid test -- --run`, per-file counts read
from `out/stats/unit.json`), 15 browser tests across 2 files
(`npx vitest run -c vitest.e2e.config.ts`), all passing as of 2026-09-10. `pnpm receipts` is
`typecheck && test && build`.

| file | tests | covers |
| --- | --- | --- |
| `src/1_axis.test.ts` | 38 | the operators, cycles, restrict |
| `src/2_operators.test.ts` | 55 | filter operators, comparators |
| `src/3_paths.test.ts` | 24 | templates, attrs, routing, intents, css vars |
| `src/4_slice.test.ts` | 46 | partition, paginate, sizers, window, trackList |
| `src/5_columns.test.ts` | 26 | the six built-in column factories |
| `src/7_epics.test.ts` | 43 | the twelve epics |
| `src/8_grid.test.ts` | 32 | the constructor, the view chain, the `sync` listener |
| `src/9_css.test.ts` | 10 | `writeGridVars`: which entries become tracks, the write pass, the teardown |
| `src/10_render.test.ts` | 50 | slot precedence, built-in routes, detail rows, signal slots, `stop()` |
| `src/11_detail.test.ts` | 26 | detail keys, `withDetail`, the detail epic |
| `src/12_transpose.test.ts` | 19 | orientation, the two facets, `collapseToOneEntry`, spans |
| `src/13_composite.test.ts` | 14 | part ranks, the default stack, composite sorting, list view |
| `src/14_measure.test.ts` | 18 | one observer per store, measurement, estimate, buffer zone, scroll anchoring |
| `src/15_selection.test.ts` | 32 | the range model, block selection arithmetic |
| `src/16_menu.test.ts` | 19 | context-menu target resolution and anchor positioning |
| `src/features.test.ts` | 8 | the feature ledger's own shape |
| `src/theme.test.ts` | 5 | theme.css selectors held against what the router can address |
| `tests/0_delegation.e2e.test.ts` | 8 | delegated routing against chromium |
| `tests/1_render.e2e.test.ts` | 7 | rendered geometry read out of chromium |

Package entry is `src/index.ts`, built by `vite.config.ts:6`; the theme ships as
`@hafley66/signal-grid/theme.css` (`package.json` exports map).

## Install and smallest grid

```sh
pnpm add @hafley66/signal-grid   # peers: @hafley66/signals, @hafley66/path, @hafley66/xdom
```

```ts
// src/8_grid.test.ts, "a nested write lands and the view recomputes without any subscription"
import { grid } from "@hafley66/signal-grid"

const g = grid<Row>({ id: "t", rows: FLAT, columns: COLUMNS, rowId: (r) => r.id })
g.view.flat.$().map((n) => n.key)                  // ["c", "a", "b"]
g.state.sort.$([{ field: "size", sort: "asc" }])
g.view.flat.$().map((n) => n.key)                  // ["a", "b", "c"]
```

No subscription and no `onChange`. A computed signal recomputes on read, so a stage is asserted by
calling it. Drawing it is one more call, `render(g, root)` (`src/10_render.ts`), which the e2e
fixture makes at `fixtures/main.ts:126`.

## The one idea

Two forests: rows keyed by `RowId`, columns keyed by `ColId`. A flat grid is the case where every
key is a root, so list data and tree data run one code path (`src/1_axis.ts`). A column header
group is a `parent` edge in the column forest.

`src/1_axis.ts` holds five pure operators over an `Axis`:

| operator | defined | called from | serves |
| --- | --- | --- | --- |
| `sortAxis` | `src/1_axis.ts` | `src/8_grid.ts` | row sort, multi-column sort |
| `groupAxis` | `src/1_axis.ts` | `src/8_grid.ts` | row grouping |
| `flattenAxis` | `src/1_axis.ts` | `src/8_grid.ts` | tree data, expansion, the column forest |
| `filterAxis` | `src/1_axis.ts` | nothing | filtering is cut, see [Not built](#not-built) |
| `mapAxis` | `src/1_axis.ts` | nothing | value rewrite with structure shared |

Two more operators keep the same identity-by-reference convention: `withDetail`
(`src/11_detail.ts`) inserts one panel node per open row, and `renderPlan` (`src/4_slice.ts`)
runs partition, then paginate, then window, in that order and once.

Two constructors mint an axis: `axisOfEntries` (`src/1_axis.ts`) from flat entries plus an optional
`parentOf`, `axisOfTree` (`src/1_axis.ts`) from nested payloads. Both are total on a cyclic parent
map: a node standing on a cycle becomes a root.

## Constructor inputs

`GridConfig<TRow>` in `src/8_grid.ts`. `GridSource<T>` accepts a `Signal`, an `Observable`, a thunk, or a
bare value; `toGridSignal` adopts a signal unchanged, both in the same file.

| key | type | accepts |
| --- | --- | --- |
| `id` | `GridSource<string>` | the `{gridId}` of every path template |
| `rows` | `GridSource<readonly TRow[]>` | array, signal, observable, or thunk; fallback `[]` |
| `columns` | `GridSource<readonly ColumnDef<TRow>[]>` | same shapes; `ColumnDef` in `src/0_types.ts` |
| `rowId` | `(row: TRow) => RowId` | plain function, deliberately not reactive |
| `subRows` | `(row: TRow) => readonly TRow[] \| undefined` | present means tree mode |
| `mode` | `"client" \| "server"` | default `"client"` |
| `rowCount` | `GridSource<number \| null>` | server total, copied into `query.page.total` |
| `state` | `GridSource<Partial<GridState>>` | read once as a seed, through `toGridSignal` |
| `sync` | `string \| boolean` | url query key; `true` uses `id.$()`; `storageSignal(urlAdapter(key))` |
| `slots` | `Slots<TRow>` | `cell`, `editor`, `header`, `expander`, `detail` are read by the renderer |
| `viewport` | `GridSource<Viewport>` | `{ top, left, width, height }`; drives the window |
| `overscan` | `number` | rows padded on each side of the window, default 4 |
| `epics` | `readonly GridEpic<TRow>[]` | absent installs `defaultEpics()` (`src/7_epics.ts`) |

## Constructor outputs

`Grid<TRow>` in `src/8_grid.ts`.

| member | type | note |
| --- | --- | --- |
| `id`, `rows`, `columns`, `viewport` | signals | the adopted inputs |
| `mode` | `GridMode` | plain value, fixed at construction |
| `state` | `Signal<GridState>` | one signal, nested writes through proxy dots |
| `view.base` | `Signal<Axis<RowId, TRow>>` | `axisOfEntries` or `axisOfTree` over `rows` |
| `view.grouped` | same | identity in server mode or with no `group` keys |
| `view.sorted` | same | identity in server mode |
| `view.detailed` | same | `sorted` plus one node per open detail panel |
| `view.flat` | `Signal<readonly FlatNode<RowId>[]>` | DFS honouring `state.expanded` |
| `view.plan` | `Signal<RenderPlan<RowId>>` | `{ start, center, end, span, centerTotal, offsetTop, pageCount }` |
| `view.cols` | `Signal<readonly FlatNode<ColId>[]>` | the column forest after hide and reorder |
| `view.widths` | `Signal<ReadonlyMap<ColId, number>>` | declared widths; the browser distributes flex |
| `actions$`, `intent$`, `change$`, `effect$` | Observables | one bus, split by phase |
| `query` | `Signal<QueryDescriptor>` | `{ sort, group, page, expand }`; `expand` is always `null` |
| `page$` | `Observable<PageRequest>` | one emission per `page` change |
| `dispatch` | `(action) => void` | reduces `change`, re-broadcasts every phase |
| `epics$` | `Observable<never>` | subscribing runs the epics; `bind` does it for you |
| `bind` | `(root: HTMLElement) => () => void` | delegated listeners plus `keydown`, returns teardown |
| `slots`, `rowId` | passthrough | as configured |

## Not built

| gap | evidence |
| --- | --- |
| filtering, quick filter, filter logic | `filterAxis` and `buildRowPredicate` (`src/2_operators.ts`) have no call site; `GridState` carries no `filter` key |
| a header group band | `view.cols` carries the group node, `src/10_render.ts` drops it before the header is built |
| inline editing, column typing, aggregation | cut by decision, listed in `docs/1_parity.md` |
| `rowOrder` | state key with no reader in `src/` |

## Docs

- `docs/0_api.md` the design: laws, surface, scoping, relational, pathing, slicing, actions, slots
- `docs/1_parity.md` generated three-way feature matrix (`pnpm parity`)
- `docs/2_guide.md` task-shaped guide, one heading per thing you do
- `docs/3_competitors.md`, `docs/4_proof.md` positioning and receipts
