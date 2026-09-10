# signal-grid guide

Each heading: the goal, the code, one line on what happens underneath. Every example comes from a
passing test, named above it. Fixtures and the `run`/`pointer` harness: `src/8_grid.test.ts:13-34`
and `src/7_epics.test.ts:43-121`.

| # | task | # | task |
| --- | --- | --- | --- |
| 1 | [Flat list](#1-flat-list) | 10 | [Detail panel with a nested grid](#10-detail-panel-with-a-nested-grid) |
| 2 | [Sort, one column and many](#2-sort-one-column-and-many) | 11 | [Clicks and keys](#11-clicks-and-keys) |
| 3 | [Tree mode](#3-tree-mode) | 12 | [Virtualization on and off](#12-virtualization-on-and-off) |
| 4 | [Paging, including infinite scroll](#4-paging-including-infinite-scroll) | 13 | [Server mode](#13-server-mode) |
| 5 | [Pin a row or a column](#5-pin-a-row-or-a-column) | 14 | [Reactive rows and pipe$](#14-reactive-rows-and-pipe) |
| 6 | [Resize a column](#6-resize-a-column) | 15 | [Custom slots](#15-custom-slots) |
| 7 | [Reorder and hide columns](#7-reorder-and-hide-columns) | 16 | [Theming](#16-theming) |
| 8 | [Header groups](#8-header-groups) | 17 | [Where state lives](#17-where-state-lives) |
| 9 | [Built-in columns](#9-built-in-columns) | 18 | [Known gaps](#18-known-gaps) |

## 1. Flat list

```ts
// src/8_grid.test.ts, "a plain array becomes a writable signal"
const g = grid<Row>({ id: "t", rows: FLAT, columns: COLUMNS, rowId: (r) => r.id })
keys(g.view.flat.$())        // ["c", "a", "b"]
g.view.plan.$().center       // the keys that actually render
```

`axisOfEntries` builds the forest, `flattenAxis` walks it, `renderPlan` (`src/4_slice.ts`) windows it.

## 2. Sort, one column and many

Write a sort model, or let the header click epic write it.

```ts
// src/8_grid.test.ts, "a nested write lands and the view recomputes without any subscription"
g.state.sort.$([{ field: "size", sort: "asc" }])
keys(g.view.flat.$())        // ["a", "b", "c"]

// src/7_epics.test.ts "cycles one column asc, desc, off", "appends on shift-click"
g.dispatch(header("name"))                  // asc, desc, then []
g.dispatch(header("size", { shift: true })) // appends, keeping name first
```

`sortOnHeaderClick` (`src/7_epics.ts`) drops a column rather than storing a third direction, and
`buildComparator` (`src/2_operators.ts`) folds the model into one comparator.

## 3. Tree mode

Supply `subRows`. That is the whole configuration.

```ts
// src/8_grid.test.ts, "closed nodes hide their subtree" and "opening a node reveals exactly its children"
const g = grid<Row>({ id: "t", rows: TREE, columns: COLUMNS, rowId: (r) => r.id, subRows: (r) => r.kids })
keys(g.view.flat.$())        // ["src", "readme"]
g.state.expanded.src.$(true) // ["src", "src/a", "src/b", "readme"]
```

`flattenAxis` skips a closed node's subtree, so it never reaches the virtualizer's count.

## 4. Paging, including infinite scroll

Choose how many rows are candidates at all: writing
`g.state.page.$({ mode: "pages", index: 1, size: 2, total: null })` narrows `plan.center` to `["b"]`
(`src/8_grid.test.ts`, "paging narrows the rendered plan").

| mode | window over the center run | where |
| --- | --- | --- |
| `all` | every loaded row, `paginate` disabled | `pageWindow` in `src/8_grid.ts` |
| `pages` | `[index * size, (index + 1) * size)` | `paginate` in `src/4_slice.ts` |
| `infinite` | `[0, (index + 1) * size)` | `pageWindow` asks for index 0 at the accumulated size |

`pageWindow` turns the mode into one `paginate` call inside `renderPlan`, run after pinning is lifted
out; a page index past the end slices to empty rather than throwing.

Under `infinite` the epic raises the index for you.

```ts
// src/7_epics.test.ts, "raises the index once per boundary, not once per scroll event"
const g = flatGrid({ page: { mode: "infinite", index: 0, size: 2, total: null } }, 0)
g.dispatch(scroll(80))
g.state.page.$().index       // 1
g.page$.subscribe(({ index, size }) => fetchAndAppend(index, size))
```

`pageOnScrollNearEnd` (`src/7_epics.ts`) tests scroll position rather than counting events, a known
`page.total` stops it, and nothing in the kernel waits on `page$`.

## 5. Pin a row or a column

```ts
// src/8_grid.test.ts, "a pinned row stays pinned on a page it does not belong to"
g.state.rowPinning.b.$("end")
g.state.page.$({ mode: "pages", index: 0, size: 1, total: null })
g.view.plan.$().end          // ["b"], and center is ["c"]
g.state.colPinning.name.$("start")
```

`partition` (`src/4_slice.ts`) serves both axes: rows through `renderPlan`, which pages the center
only, columns through the renderer's three `.sg-run` boxes and the per-run offsets `writeGridVars`
accumulates (`src/9_css.ts`).

## 6. Resize a column

```ts
// src/8_grid.test.ts, "width overrides beat the column definition"
g.state.colWidth.name.$(300)
g.view.widths.$().get("name")          // 300, against a 400px viewport

// src/7_epics.test.ts, "clamps to the column's minWidth"
g.dispatch(headerDown("name", "resize", 0))
move$.next(at({ clientX: -200 }))      // colWidth.name becomes 80
```

An override clears that column's `flex`, the handle renders only when `resizable` is `true`, and one
write repaints the whole column (`tests/1_render.e2e.test.ts:240`).

## 7. Reorder and hide columns

Write the order, or drag the header's move handle.

```ts
// src/8_grid.test.ts "explicit order wins over declaration order", src/7_epics.test.ts "reorders once
// the pointer passes half of the next column"
g.state.colOrder.$(["size", "name"])   // keys(g.view.cols.$()) is ["size", "name"]
g.dispatch(headerDown("name", "move", 0))
move$.next(at({ clientX: 60 }))        // the drag writes the same key
```

`view.cols` ranks by position in `colOrder` and sends an unlisted column to the end; `landingIndex`
(`src/6_gestures.ts`) measures from where the drag began (`src/7_epics.test.ts`).

Hiding is the same shape, one write to `colHidden`.

```ts
// src/8_grid.test.ts, "there are no onChange pairs: writing the signal is the whole api"
g.state.colHidden.size.$(true)
keys(g.view.cols.$())                  // ["name"]
```

Hidden columns leave before the column forest is built, so they take no pixels and the renderer
builds nothing for them (`tests/1_render.e2e.test.ts:224`).

## 8. Header groups

Give a column a `group`, and add the group as a column of its own.

```ts
// src/8_grid.test.ts, "a header group becomes a parent edge in the column forest"
const columns = [{ id: "meta" }, { id: "name", group: "meta" }, { id: "size", group: "meta" }]
g.view.cols.$().map((n) => [n.key, n.depth])   // [["meta", 0], ["name", 1], ["size", 1]]
```

`ColumnDef.group` is the `parentOf` handed to `axisOfEntries`, so a missing parent becomes a root, and the
renderer draws no group band (`src/10_render.ts`).

## 9. Built-in columns

Add a glyph column without writing its wiring: `columns: [checkboxColumn({ grid: () => g }), ...DATA]`.
Its header is a live `Signal<string>` cycling "☐", "☑", "☒" (`src/5_columns.test.ts`, "reads the
tri-state off the grid it was handed").

All six live in `src/5_columns.ts`.

| factory | default id | its cell |
| --- | --- | --- |
| `checkboxColumn` | `__check` | a `check` route box, live select-all toggle in the header |
| `radioColumn` | `__radio` | the same box and route, no select-all toggle |
| `expandColumn` | `__expand` | the expander, indented by `--sg-depth` |
| `dragColumn` | `__drag` | a `move` route handle |
| `detailColumn` | `__detail` | a disclosure with no route of its own |
| `rowNumberColumn` | `__rowNumber` | `FlatNode.index + start + offset()` |

Never groupable, sortable, filterable, resizable, or editable, min and max pinned to width
(`src/5_columns.test.ts`); the renderer prefers `ColumnDef.cell` and `ColumnDef.headerCell` over the
schema-wide slots.

## 10. Detail panel with a nested grid

Open a panel under a row, holding a second grid.

```ts
// src/11_detail.test.ts, "builds a second grid inside the slot and derives it"
const detail = (ctx: RowCtx<Row>) => {
  const sub = grid<Row>({ id: `sub:${ctx.row}`, rows: ctx.data.kids ?? [], columns, rowId })
  const host = document.createElement("div")
  render(sub, host)
  return host
}
const g = grid<Row>({ ...cfg, slots: { detail }, epics: [...defaultEpics<Row>(), detailOnCellClick()] })
g.state.rowHeight.$(detailHeights(g.state.detail.$(), 320, g.state.rowHeight.$()))
```

`withDetail` (`src/11_detail.ts`) runs inside `view.detailed`, so the panel is windowed and sized in
the row index space; without a height from `detailHeights` the scroll drifts. The panel row carries
`data-detail="true"` and draws from `Slots.detail`.

## 11. Clicks and keys

Hear "the user picked this row" once, with the row's data attached.

```ts
// src/7_epics.test.ts, "turns a plain click into an activate effect"
g.effect$.subscribe(handle)
g.dispatch(cell("a", "name"))
// { phase: "effect", type: "activate", row: "a", col: "name", value: FLAT[1] }
```

`activateOnCellClick` (`src/7_epics.ts`) declines a modified click. There is no `row.click`, and
`cell.pointerdown`, `cell.pointerenter`, and `row.hover` have intent constructors `bind` never wires.

Keys arrive the same way: `g.dispatch(key("ArrowDown"))` writes `state.focus`
(`src/7_epics.test.ts`, "moves focus down the flat list and back up").

| key | effect |
| --- | --- |
| ArrowDown, ArrowUp | step `focus` through the flat list, clamped |
| ArrowRight | open the focused node when it has closed children |
| ArrowLeft | close it, else step to its parent (`src/7_epics.test.ts`) |
| Space, Enter | toggle `rowSelection`, emit `activate` (`src/7_epics.test.ts`) |

`render()` sets `tabIndex` when the consumer left it unset (`src/10_render.ts`), an unfocused
grid sits at index -1 (`src/7_epics.ts`), and nothing paints a focus ring.

## 12. Virtualization on and off

```ts
// src/8_grid.test.ts, "off renders every row in the page"
g.state.virtualize.$(false)
g.view.plan.$().center                 // ["c", "a", "b"]
```

Off makes the window step the identity; on, it is `windowOf` over the page run's `Sizer` plus
`overscan` (`src/4_slice.ts`).

## 13. Server mode

Hand the grid a resolved page and read the descriptor it wants fetched.

```ts
// src/8_grid.test.ts, "sorting is not re-applied locally" and "the query descriptor carries what the caller must send upstream"
const g = grid<Row>({ id: "t", mode: "server", rows: FLAT, columns: COLUMNS, rowId: (r) => r.id, rowCount: 400 })
g.state.sort.$([{ field: "size", sort: "asc" }])
keys(g.view.flat.$())                  // ["c", "a", "b"], server order is kept
g.query.$()                            // { sort, group, page: { ..., total: 400 }, expand: null }
```

`grouped` and `sorted` are identity in server mode while detail, flattening, pinning, and
virtualization still run; `expand` is hardcoded `null`, so drive lazy loading off `intent$`.

## 14. Reactive rows and pipe$

Keep the row source live, with an RxJS pipeline in front of it if you want one.

```ts
// src/8_grid.test.ts "an adopted signal stays the same instance", "a thunk becomes a computed";
// packages/signals/src/11_pipe.test.ts:7-13 "wraps a synchronous pipeline into a signal"
grid<Row>({ id: "t", rows, columns, rowId }).rows === rows          // an adopted signal, writable
grid<Row>({ id: "t", rows: () => src.$().filter(big), columns, rowId })            // a thunk
grid<Row>({ id: "t", rows: src.$.pipe$(debounceTime(50), map(norm)), columns, rowId })
```

`pipe$` is both a method on the `$` accessor (`packages/signals/src/1_SignalCreator.ts:305`) and a
free function over an Observable or a Signal (`packages/signals/src/2_Signal.ts:72`).

## 15. Custom slots

Replace a rendered part, and give one cell live content without a signal per cell.

```ts
// fixtures/main.ts:96-101,123, the page tests/1_render.e2e.test.ts asserts against
slots: { cell: (ctx) => label(String(ctx.value ?? "")) }
// a slot may return a signal instead; the select-all toggle in src/5_columns.ts is the reference case
const header: Slot<HeaderCtx> = () => Signal<string>(() => SELECT_ALL_GLYPH[selectAllState(rows, sel.$())])
```

`cell`, `editor`, `header`, `expander`, and `detail` reach the renderer, and a per-column `cell` or
`headerCell` beats the schema-wide one; `mount` subscribes a returned signal into the row's
`Subscription`, and a row rebuilds its cells only when its data, column run, or editing flag moved.

## 16. Theming

Restyle by overriding a custom property on the grid root, for example
`.my-grid { --sg-row-h: 28px; --sg-indent: 24px }`; every name and default is at `src/theme.css:10-25`.

| written by the kernel | meaning |
| --- | --- |
| `--sg-row-h`, `--sg-total-h`, `--sg-offset-y` | density, scroll spacer, translate of the windowed run (`src/9_css.ts`) |
| `--sg-h-w-<col>`, `--sg-h-x-<col>` | one width and one offset per visible column (`src/3_paths.ts`) |
| `--sg-r-h-<row>`, aliased per row as `--sg-h` | a row's height override (`src/3_paths.ts`, `src/9_css.ts`) |
| `--sg-depth` | tree indent, written once per row (`src/10_render.ts`) |

Everything is scoped under `[data-route="g"]`, so two grids are two property scopes. `writeGridVars`
(`src/9_css.ts`) writes one pass per frame and drops a property whose column left the schema. Import
`@hafley66/signal-grid/theme.css`.

## 17. Where state lives

Read and write any part of the state through one signal: `g.state.colHidden.size.$(true)` writes,
`g.state.colHidden.size.$()` reads, `g.state.$()` is the whole `GridState` (`src/8_grid.test.ts`,
"there are no onChange pairs: writing the signal is the whole api").

A signal is both halves already (`src/0_types.ts`), a nested path mints no signal until
something touches it, and a nested-path selector dedupes with `distinctShallow`
(`packages/signals/src/1_SignalCreator.ts:334`). `sync: "q"` backs the same state with
`storageSignal(urlAdapter(key))`.

## 18. Known gaps

| gap | what is missing | evidence |
| --- | --- | --- |
| filtering | no `filter` key in `GridState`, no view stage calling `filterAxis` or `buildRowPredicate` | `src/1_axis.ts` |
| header group band | group nodes leave the leaf run before the header is built | `src/10_render.ts` |
| `Slots.row`, `checkbox`, `headerGroup`, `resizeHandle`, `dragPreview`, `empty`, `loading`, `footer` | declared, unread | `Slots` in `src/0_types.ts` |
| focus ring, inline editing | `state.focus` has no renderer; `state.editing` has no writer | `src/7_epics.ts`, `src/10_render.ts` |
| `rowOrder` | state key with no reader in `src/` | `GridState` in `src/0_types.ts` |
| `query.expand` | hardcoded `null`, so server tree loading has no kernel trigger | the `query` computed in `src/8_grid.ts` |
| column virtualization, autosize, export, undo, a11y roles, i18n | not attempted | `docs/1_parity.md` |
| aggregation, column typing, pivot | cut by decision | `docs/1_parity.md`, "Cut on purpose" |
