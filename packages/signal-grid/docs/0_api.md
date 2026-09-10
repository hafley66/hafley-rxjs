# signal-grid: API, pathing, slicing

Two ordered forests, pure operators over them, a three-phase action grammar, and
`@hafley66/signals` for derivation with plain RxJS for gestures and timing. No React.

## TOC

0. [Status](#0-status)
1. [The five laws](#1-the-five-laws)
2. [Surface](#2-surface)
3. [Signal scoping](#3-signal-scoping)
4. [Relational model](#4-relational-model)
5. [Pathing model](#5-pathing-model)
6. [Slicing model](#6-slicing-model)
7. [Action grammar and the epics](#7-action-grammar-and-the-epics)
8. [Slots](#8-slots)
9. [Test kit](#9-test-kit)
10. [Not built](#10-not-built)
11. [File map](#11-file-map)

---

## 0. Status

Verified against source on 2026-09-10 by running `pnpm -F @hafley66/signal-grid test -- --run`
(465 passed, 17 files, per-file counts from `out/stats/unit.json`) and
`npx vitest run -c vitest.e2e.config.ts` (15 passed, 2 files).

| area | state | evidence |
| --- | --- | --- |
| `GridSource<T>`, the constructor, the state signal, the view chain | built | `grid()` in `src/8_grid.ts`, 32 tests in `src/8_grid.test.ts` |
| axis operators, tree, grouping | built | `src/1_axis.ts`, 38 tests |
| partition, paginate, sizers, window, trackList | built | `src/4_slice.ts`, 46 tests |
| path templates, attrs, intents, CSS var names | built | `src/3_paths.ts`, 24 tests |
| built-in columns: check, radio, expand, drag, detail, row number | built | `src/5_columns.ts`, 26 tests |
| one `drag` operator serving resize, column move, row move | built | `src/6_gestures.ts`, driven by `src/7_epics.ts` |
| twelve epics, installed by default | built | `src/7_epics.ts`, 43 tests |
| detail panels as row-axis nodes | built | `src/11_detail.ts`, 26 tests |
| CSS custom property writer | built | `src/9_css.ts`, asserted through chromium at `tests/1_render.e2e.test.ts:155` |
| DOM renderer and event binding | built | `src/10_render.ts`, `bindRoot` in `src/8_grid.ts`, 7 e2e tests |
| theme | built | `src/theme.css`, exported as `./theme.css` in `package.json` |
| package entry | built | `src/index.ts`, entry of `vite.config.ts:6` |
| filtering in the view chain | not built | `filterAxis` (`src/1_axis.ts`) and `buildRowPredicate` (`src/2_operators.ts`) have no call site in `src/`; `GridState` has no `filter` key |
| inline editing | cut | `GridState.editing` is read at `src/10_render.ts` and written by nothing |
| aggregation, column typing, pivot | cut | `docs/1_parity.md`, "Cut on purpose" |
| transpose: `orientation`, `view.vertical`/`horizontal`/`spans`/`covered`, `listView` through `collapseToOneEntry` | built | `src/12_transpose.ts` |

## 1. The five laws

| # | law | consequence |
| --- | --- | --- |
| 1 | One deep state signal per grid, reached by proxy dots | `g.state.colWidth.name.$(140)` creates no signal at author time; the proxy makes it lazily |
| 2 | Derivation is a chain of computed signals, one per stage | every member of `GridView` is one computed; a stage that stops reading `group` stops depending on it |
| 3 | Anything with `filter`, a deadline, or a gesture is plain RxJS | a drag is `takeUntil` over a live pointer stream (`src/6_gestures.ts`), never a signal |
| 4 | One path template is the element attrs, the event route, the CSS var namespace, and the test selector | `src/3_paths.ts`; `LOCAL` (`src/3_paths.ts`) is the single declaration |
| 5 | Every subscription is opened by `bind`, `render`, or `writeGridVars` and handed back as a teardown | the only `.subscribe(` calls in `src/` sit in `bindRoot`, `src/9_css.ts`, and `src/10_render.ts` |

## 2. Surface

### inputs: `GridSource<T>`

```ts
// src/8_grid.ts
export type GridSource<T> = Sig<T> | Observable<T> | (() => T) | T
export function toGridSignal<T>(source: GridSource<T>, fallback: T): Sig<T>
```

| you pass | you get | when to use |
| --- | --- | --- |
| `[{ id: 1 }]` | a writable signal seeded with it | static rows |
| `rows$` | a signal fed by the observable, `fallback` until it emits | server or websocket rows |
| `() => base.$().filter(ok)` | a computed that re-derives on any signal it read | rows derived from other state |
| `existingSignal` | that same signal, adopted | two grids sharing one source, or a caller who wants to write |

Adoption is asserted by `src/8_grid.test.ts`, "an adopted signal stays the same instance, so
the caller can still write it".

### the call

```ts
// shape taken from fixtures/main.ts:107-124, the page both e2e suites load
const g = grid<FileRow>({
  id: "files",
  rows: ROWS,
  columns: COLUMNS,
  rowId: (row) => row.id,
  subRows: (row) => row.kids,
  state: Signal<Partial<GridState>>({ virtualize: false, colHidden: { mtime: true } }),
  viewport,
  slots: { cell: (ctx) => label(String(ctx.value ?? "")) },
})
```

`rowId` and `subRows` stay plain functions: row identity changing reactively would invalidate
selection, expansion, and pinning at once, which is a data reload rather than a state change
(`src/8_grid.ts`).

### state, one signal, proxy dots

```ts
// src/8_grid.test.ts
g.state.$()                                     // whole GridState
g.state.sort.$([{ field: "size", sort: "asc" }])
g.state.colHidden.size.$(true)
g.state.colWidth.name.$(300)
```

`GridState` lives in `src/0_types.ts`. Row axis: `sort`, `group`, `expanded`, `rowSelection`,
`rowPinning`, `rowHeight`, `rowOrder`, `detail`, `page`. Column axis:
`colOrder`, `colHidden`, `colWidth`, `colPinning`. Cross: `selection`, `focus`, `editing`.
View: `density`, `listView`, `virtualize`, and `orientation`.

`page` is one `Page` carrying `mode: "all" | "pages" | "infinite"`, `index`,
`size`, and a server-only `total`.

### view, a chain, each stage readable

```ts
// the `view` object built by `grid()` in src/8_grid.ts
g.view.base.$()       // Axis<RowId, TRow>          axisOfEntries or axisOfTree
g.view.grouped.$()    // Axis<RowId, TRow>          groupAxis, identity in server mode
g.view.sorted.$()     // Axis<RowId, TRow>          sortAxis, identity in server mode
g.view.detailed.$()   // Axis<RowId, TRow>          withDetail, one node per open panel
g.view.flat.$()       // FlatNode<RowId>[]          DFS honouring expanded
g.view.plan.$()       // RenderPlan<RowId>          pinning, paging, window
g.view.cols.$()       // FlatNode<ColId>[]          the column forest after hide and reorder
g.view.widths.$()     // ReadonlyMap<ColId, number> flex resolution
```

### streams

```ts
// the streams `grid()` returns, src/8_grid.ts
g.actions$            // Observable<GridAction<TRow>>
g.intent$ g.change$ g.effect$   // the same bus narrowed by phase
g.query               // Signal<QueryDescriptor>, server mode
g.page$               // Observable<PageRequest>, one per page change
```

### the two impure calls

```ts
const stop = g.bind(root)            // bindRoot in src/8_grid.ts: delegated listeners, keydown, epics
const handle = render(g, root)       // src/10_render.ts, calls bind itself at line 348
handle.stop()
```

`render` is optional. The kernel never needs a DOM to be correct: every test in
`src/8_grid.test.ts` reads the chain with no document at all.

### client and server mode

| stage | client | server |
| --- | --- | --- |
| group | kernel | skipped, published in `query` |
| sort | kernel | skipped, published in `query` |
| paginate | kernel | published in `query`; `rows` is the page |
| detail, tree flatten, pinning, virtualization, selection | kernel | kernel |

```ts
// src/8_grid.test.ts, "the query descriptor carries what the caller must send upstream"
const g = grid<Row>({ id: "t", mode: "server", rows: FLAT, columns: COLUMNS, rowId: (r) => r.id, rowCount: 400 })
g.state.page.$({ mode: "infinite", index: 1, size: 50, total: null })
g.query.$()   // { sort, group, page: { mode: "infinite", index: 1, size: 50, total: 400 }, expand: null }
```

## 3. Signal scoping

| rule | why |
| --- | --- |
| exactly one `Signal<GridState>` per grid | the creator proxies nested paths lazily, so a 40-column grid still holds one signal until something reads a sub-path |
| eight computed signals in `view`, in a chain | a computed re-derives its dep set every run, so a branch that stops reading a key stops subscribing to it |
| never a signal per row, per column, or per cell | per-cell liveness comes from a slot returning a signal, which `mount` (`src/10_render.ts`) subscribes into the row's own `Subscription` |
| gestures, scroll, keyboard: RxJS only | these need `filter`, `takeUntil`, `switchMap` over live events; a signal cannot decline to emit |
| epics are `Epic<GridAction, GridState, GridEpicCtx>` from `@hafley66/signals` | already queue-scheduled for causal order and bounded recursion; `createSlice` is called by `grid()` |

`@hafley66/signals` dedupes a nested-path selector with `distinctShallow` by default
(`packages/signals/src/1_SignalCreator.ts:55,334`) and exposes the operator slot as
`SELECTOR_SLOT.distinct` (`packages/signals/src/1_SignalCreator.ts:62`), so a write to one branch no
longer re-emits every other branch. That is what took a `colWidth` write at 50k rows from 76 ms to
0.0 ms; the note on the cost that motivated the memo shape sits above `grid()` in `src/8_grid.ts`.

## 4. Relational model

One container, `Axis<K, T>`: `roots`, `children`, `parent`, `by` (`src/0_types.ts`). A flat grid
is the case where every key is a root. `src/1_axis.ts` holds five pure operators:

| operator | signature | serves |
| --- | --- | --- |
| `filterAxis` | `(Axis, keep, FilterMode) => Axis` | nothing today, see section 10 |
| `sortAxis` | `(Axis, cmp \| null) => Axis` | row sorting |
| `groupAxis` | `(Axis, keyOf[], makeGroup) => Axis` | row grouping |
| `flattenAxis` | `(Axis, isOpen) => FlatNode[]` | tree data, expansion, the column axis |
| `mapAxis` | `(Axis, f) => Axis` | nothing today; structure is shared by reference |

Plus two constructors, `axisOfEntries` and `axisOfTree`, and two walks, `ancestorsOf`
and `descendantsOf`. `descendantsOf` has one caller: alt-click whole-branch expansion
(`src/7_epics.ts`).

`withDetail` (`src/11_detail.ts`) is a sixth axis operator living in its own module because a
panel is a synthetic key. It inserts one node per open row directly after that row in its sibling
list, so a panel is visible exactly when its row is, and it is idempotent
(`src/11_detail.test.ts`).

Every operator returns the input by reference when it changed nothing, so a downstream stage can
compare with `===` and skip its own work (`src/1_axis.ts`).

`FilterMode` (`src/0_types.ts`) exists because a tree filter has three defensible answers:
`prune`, `ancestors`, `subtree`. Nothing in the grid reads it yet.

Two namespaces keep synthetic keys off real ids: `GROUP_PREFIX` is `"g:"` (`src/0_types.ts`), and
`DETAIL_PREFIX` is NUL plus `"d:"` (`src/11_detail.ts`), NUL because a `RowId` is a user string
and may well start with `d:` (`src/11_detail.test.ts`).

## 5. Pathing model

Built by concatenation, so the child template literally contains the parent (`src/3_paths.ts`).

| part | template | skeleton |
| --- | --- | --- |
| grid root | `/g/{gridId}` | `g` |
| viewport | `/g/{gridId}/vp` | `g/vp` |
| header cell | `/g/{gridId}/h/{colId}` | `g/h` |
| resize handle | `/g/{gridId}/h/{colId}/resize` | `g/h/resize` |
| header move handle | `/g/{gridId}/h/{colId}/move` | `g/h/move` |
| row | `/g/{gridId}/r/{rowId}` | `g/r` |
| expander | `/g/{gridId}/r/{rowId}/expand` | `g/r/expand` |
| row checkbox | `/g/{gridId}/r/{rowId}/check` | `g/r/check` |
| row move handle | `/g/{gridId}/r/{rowId}/move` | `g/r/move` |
| cell | `/g/{gridId}/r/{rowId}/c/{colId}` | `g/r/c` |

`/move` appears twice on purpose: the disambiguating segment is the ancestor's
(`src/3_paths.ts`).

| use | call | result |
| --- | --- | --- |
| DOM attrs | `rowAttrs(id)` (`src/3_paths.ts`) | `data-route="g/r"`, `data-row-id` |
| event stream | `gridDom(id).cell.route.click` (`src/3_paths.ts`) | delegated event carrying typed `params` |
| intent | `intentOf["cell.click"](event)` (`src/3_paths.ts`) | a `GridIntent`, no state moved |
| CSS var namespace | `colWidthVar(col)` (`src/3_paths.ts`) | `--sg-h-w-<encoded>` |
| test selector | `selectorFor("cell", { colId })` (`src/3_paths.ts`) | `[data-route="g/r/c"][data-col-id="size"]` |

A custom property name is an ident, so `encodeVarId` (`src/3_paths.ts`) encodes anything outside
`[A-Za-z0-9-]` as `_<hex>-`, and `decodeVarId` decodes it.

Relative delegation joins `data-route` segments up the ancestor chain and takes each param from the
closest ancestor carrying it, so a cell stamps only its `colId` and inherits `gridId` and `rowId`.
One delegated listener per event name serves the page whatever the row count; the sharing is
asserted at `fixtures/main.ts:166` and read back by `tests/0_delegation.e2e.test.ts`.

Two elements deliberately carry no route: the scroll box (`src/10_render.ts`) and the run box
(`src/10_render.ts`). A routed element between the grid and its rows would lengthen every cell
chain into one no template declares.

## 6. Slicing model

```
flat: readonly K[]
  -> partition(rowPinning)      -> { start, center, end }
       -> paginate(pageWindow)      center only
            -> windowOf(viewport, sizer)   paginated center only
                 -> rendered = start ++ window(center) ++ end
```

| invariant | reason | evidence |
| --- | --- | --- |
| a pinned key is never paginated or virtualized away | pinning means "always visible" | `src/8_grid.test.ts` |
| `virtualize: false` makes the window step the identity | the toggle must not change any other stage | `src/4_slice.ts`, `src/8_grid.test.ts` |
| overscan lives in the viewport-to-`IndexRange` step | the kernel stays a pure function of an `IndexRange` | `src/4_slice.ts` |
| the `Sizer` is built over the page run, not the flat list | pinning lifts rows out and paging drops others, so a flat-list index names a different row | `sizerFor` in `src/8_grid.ts`, `tests/1_render.e2e.test.ts:129` |

`pageWindow` turns the three retention rules into one `paginate` call: `all`
disables it, `pages` passes the index through, `infinite` asks for index 0 with size
`(index + 1) * size`.

`Sizer` (`src/4_slice.ts`) is the only source of pixels. `uniformSizer` is O(1) per
lookup; `measuredSizer` is a prefix sum with a binary search, chosen by `sizerFor`
when any key in the run carries a `rowHeight` override.

`view.widths` reports declared widths, not resolved ones: the browser owns distribution through the
CSS `trackList` grammar in `src/4_slice.ts`, which emits `fr` and `minmax()` into
`grid-template-columns`, so a flex column reports its default and a caller wanting the painted width
reads the element (`src/8_grid.ts:430`).

## 7. Action grammar and the epics

Three phases, one bus (`GridIntent`, `GridChange`, `GridEffect` in `src/0_types.ts`).

| phase | meaning | shape |
| --- | --- | --- |
| `intent` | the DOM saw something, no state has moved | 13 members, every one minted by `intentOf` |
| `change` | one key of `GridState` was written | `{ phase, type: K } & { [K]: GridState[K] }`, reduced synchronously by `reduce` |
| `effect` | leaves the grid; the consumer decides what it means | `activate`, `editCommit`, `editCancel`, `reorderRow`, `copy`, `paste`, `custom` |

`defaultEpics()` (`src/7_epics.ts`) installs twelve. `GridConfig.epics` replaces the list, which is
how one is dropped or an opt-in one added.

| epic | reads | writes | test |
| --- | --- | --- | --- |
| `sortOnHeaderClick` | `header.click` | `sort`, cycling asc, desc, off; shift appends | `src/7_epics.test.ts` |
| `expandOnExpanderClick` | `expander.click` | `expanded`; alt takes the whole subtree | `src/7_epics.test.ts` |
| `selectRowsOnCheckboxClick` | `checkbox.click` | `rowSelection`; shift fills the range in view order | `src/7_epics.test.ts` |
| `activateOnCellClick` | `cell.click` with no modifier | effect `activate` | `src/7_epics.test.ts` |
| `resizeOnHeaderDrag` | `header.pointerdown` part `resize` | `colWidth`, clamped to min and max | `src/7_epics.test.ts` |
| `moveColumnOnHeaderDrag` | `header.pointerdown` part `move` | `colOrder` | `src/7_epics.test.ts` |
| `moveRowOnRowDrag` | `row.pointerdown` | effect `reorderRow`, on commit only | `src/7_epics.test.ts` |
| `keyboardNav` | `key` | `focus`, `expanded`, `rowSelection`, effect `activate` | `src/7_epics.test.ts` |
| `pageOnScrollNearEnd` | `viewport.scroll` | `page.index`, infinite mode only | `src/7_epics.test.ts` |
| `selectCellsOnDrag` | `cell.pointerdown` | `selection` | `src/7_epics.test.ts` |
| `selectRowsOnDrag` | `header.pointerdown` part `select` on the gutter | `selection` | `src/7_epics.test.ts` |
| `selectColumnsOnDrag` | `header.pointerdown` part `select` | `selection` | `src/7_epics.test.ts` |

`detailOnCellClick` (`src/11_detail.ts`) is opt-in, so a plain grid reduces a cell click to
nothing but `activate`.

Resize, column move, and row move are one gesture with three hit tests: `drag`
(`src/6_gestures.ts`) is `switchMap` into `move$.pipe(takeUntil(up$))` merged with the commit,
and `landingIndex` decides a neighbour is passed at half its size. `setDragStreams` swaps the pointer
source for Subjects, which is how every drag test runs with no window (`src/7_epics.test.ts`).

## 8. Slots

`Slots<TRow>` and `Slot<Ctx>` are in `src/0_types.ts`. A slot returns a `Renderable`, or a signal of
one. Returning a signal is the live-cell case: `mount` (`src/10_render.ts`) subscribes that one node
into the row's `Subscription`, so a value change repaints one cell and the row around it never
re-renders.

| slot | read by the renderer | at |
| --- | --- | --- |
| `cell` | yes; `ColumnDef.cell` beats `Slots.cell` | `src/10_render.ts` |
| `editor` | yes, when `state.editing` names a cell in this row | `src/10_render.ts` |
| `header` | yes; `ColumnDef.headerCell` beats `Slots.header` | `src/10_render.ts` |
| `expander` | yes | `src/10_render.ts` |
| `detail` | yes, on a detail panel row | `src/10_render.ts` |
| `headerGroup`, `row`, `checkbox`, `resizeHandle`, `dragPreview`, `empty`, `loading`, `footer` | no | declared only |

There are no value/onChange pairs anywhere in the package: a signal is both halves already
(`src/0_types.ts`).

The select-all toggle is the reference live slot. `checkboxColumn({ grid: () => g })` builds a
`Signal<string>` that reads `view.flat` and `state.rowSelection` and answers one of three glyphs,
counting neither group rows nor detail panels (`src/5_columns.ts`, asserted at
`src/5_columns.test.ts`).

## 9. Test kit

| helper | where | what it does |
| --- | --- | --- |
| `run(g)` | `src/7_epics.test.ts` | subscribes `epics$` and `effect$`, collects effects, unsubscribes via `onTestFinished` |
| `pointer()` | `src/7_epics.test.ts` | swaps `WINDOW_DRAG` for two Subjects through `setDragStreams` |
| `setDragStreams` | `src/6_gestures.ts` | the production seam those tests use; returns the restore function |
| `selectorFor` | `src/3_paths.ts` | the same attrs the renderer stamps, as a CSS selector, used by both e2e suites |
| `window.__patch` / `window.__plan` | `fixtures/main.ts:140,143` | writes state and reads the plan from inside chromium |

Everything else is a synchronous `.$()` read: a computed recomputes lazily on read, so a pipeline
stage is asserted without observing it (`src/8_grid.test.ts`).

## 10. Not built

| item | evidence | reason |
| --- | --- | --- |
| filtering, quick filter, and/or logic, faceting | `filterAxis` and `buildRowPredicate` have no call site in `src/`; `GridState` has no `filter` key | cut, `docs/1_parity.md` |
| aggregation | no `FeatureId` implementation, no code | cut: arithmetic over a group, not a relational operator |
| column typing (`ColumnType` as a driver of editor and operators) | `ColumnType` reaches `operatorsFor` and `comparatorFor` only | cut |
| inline editing | `state.editing` is read at `src/10_render.ts`, written by no epic | cut, the consumer owns the form lifecycle |
| a header group band | `src/10_render.ts` drops group nodes before the header is built | not wired; `view.cols` does carry the node |
| `mapAxis`, `FilterMode` | `mapAxis` has no caller; `ancestorsOf` is reached only through `filterAxis`, which has none | available, unused |
| `rowOrder` | state key with no reader in `src/` | inert |
| `query.expand` | hardcoded `null` in the `query` computed | lazy server tree loading has no trigger inside the kernel |
| column virtualization | no code | not attempted |

## 11. File map

| file | owns |
| --- | --- |
| `0_types.ts` | the contract, no logic |
| `1_axis.ts` | the five pure operators, two constructors, two walks |
| `2_operators.ts` | filter operators and comparators over single values |
| `3_paths.ts` | path templates, attrs, selectors, intents, CSS var names |
| `4_slice.ts` | partition, paginate, sizers, window, flex widths |
| `5_columns.ts` | the six built-in column factories |
| `6_gestures.ts` | one `drag` operator and `landingIndex` |
| `7_epics.ts` | intent to change and effect, twelve epics plus `defaultEpics` |
| `8_grid.ts` | `grid()`, the state signal, the view chain, `bind` |
| `9_css.ts` | the custom property writer, one frame, one write pass |
| `10_render.ts` | plain-DOM renderer, key-based row reconciliation |
| `11_detail.ts` | detail keys, `withDetail`, `detailOnCellClick` |
| `index.ts` | the barrel, one `export *` per module |
| `theme.css` | every custom property with a default, plus the layout |
| `12_transpose.ts` | transpose: `orientation`, the two facets, spans, `coveredBy` |
| `features.ts` | the feature ledger `scripts/parity.mjs` reads; not package API |
