# Epics

An epic turns intents into changes and effects. Replacing one, dropping one, or adding one is
editing an array you hand to the constructor.

```ts
type GridEpic<TRow> = (
  actions$: Observable<GridAction<TRow>>,
  state: Signal<GridState>,
  ctx: GridEpicCtx<TRow>,
) => Observable<GridAction<TRow>>
```

Declared in `src/7_epics.ts`. An epic reads the state signal and the derived view through its ctx,
touches no DOM, and is never asynchronous.

## The twelve installed by default

| epic | reads | writes |
| --- | --- | --- |
| `sortOnHeaderClick` | `header.click` | `sort`, cycling ascending, descending, off; shift appends |
| `expandOnExpanderClick` | `expander.click` | `expanded`; alt takes the whole subtree |
| `selectRowsOnCheckboxClick` | `checkbox.click` | `rowSelection`; shift fills the range in view order |
| `activateOnCellClick` | `cell.click` with no modifier | the `activate` effect, plus `focus` |
| `resizeOnHeaderDrag` | `header.pointerdown` on the resize part | `colWidth`, clamped to min and max |
| `moveColumnOnHeaderDrag` | `header.pointerdown` on the move part | `colOrder` |
| `moveRowOnRowDrag` | `row.pointerdown` | the `reorderRow` effect, on commit only |
| `keyboardNav` | `key` | `focus`, `expanded`, `rowSelection`, and the `activate` effect |
| `pageOnScrollNearEnd` | `viewport.scroll` | `page.index`, in infinite mode only |
| `selectCellsOnDrag` | `cell.pointerdown` | `selection` |
| `selectRowsOnDrag` | `header.pointerdown` on the gutter | `selection` |
| `selectColumnsOnDrag` | `header.pointerdown` on the select part | `selection` |

`defaultEpics()` in `src/7_epics.ts` returns that list. `config.epics` replaces the whole list, which
is how one is dropped or an opt-in one added.

## Replacing one

Nothing registers by name, so the filter is by identity against the array you built.

```ts
import { defaultEpics, sortOnHeaderClick } from "@hafley66/signal-grid"

const singleColumnSort: GridEpic<Row> = (actions$) =>
  actions$.pipe(
    filter((it) => it.phase === "intent" && it.type === "header.click"),
    map((it) => ({ phase: "change", type: "sort", sort: [{ field: it.col, sort: "asc" }] })),
  )

const base = defaultEpics<Row>().filter((it) => it !== sortOnHeaderClick)
grid<Row>({ ...config, epics: [...base, singleColumnSort] })
```

## Dropping one

```ts
grid<Row>({ ...config, epics: defaultEpics<Row>().slice(1) })
```

The sort epic is first in the list, so a grid whose headers must never sort ships the tail.

## Adding an opt-in one

`detailOnCellClick` in `src/11_detail.ts` is written to be appended rather than installed, which is
why a plain grid reduces a cell click to an `activate` effect and nothing else.

```ts
grid<Row>({ ...config, epics: [...defaultEpics<Row>(), detailOnCellClick({ columns: ["__detail"] })] })
```

## The opt-in ones

| epic | reads | writes |
| --- | --- | --- |
| `selectRowsOnCellClick` | `cell.click` | `rowSelection`; plain replaces, ctrl or meta toggles, shift fills the range |
| `expandOnCellDoubleClick` | `cell.dblclick` on a row that has children | `expanded`; alt takes the whole subtree |
| `toggleSelectAllOnHeaderClick` | `header.click` on the checkbox column | `rowSelection`, over `selectableRows` |
| `toggleExpandAllOnHeaderClick` | `header.click` on the expand column | `expanded`, over `expandableRows` |
| `detailOnCellClick` | `cell.click` | `detail` |

Both new ones read `interactive`, which `cell.click` and `cell.dblclick` carry: it is true when the
click landed on an anchor, a form control, or one of the grid's own routed glyphs, and both epics
step aside for it. A grid whose cells are links therefore navigates rather than selecting, and a
double click on the expander glyph is the two clicks under it and nothing more.

```ts
grid<Row>({
  ...config,
  epics: [...defaultEpics<Row>(), selectRowsOnCellClick<Row>(), expandOnCellDoubleClick<Row>()],
})
```

Installed together, a double click on a row body selects that row and opens it. A plain click
replaces the selection with the row it named, so the second click of the pair writes what the first
already wrote, and the state after the gesture is the same one click leaves plus the expansion.

## Why they are synchronous

An epic runs inside a queue-scheduled slice, which is what gives causal order and bounded recursion:
a change produced by an epic is reduced before the next intent is delivered. Waiting inside one
would break that ordering, so anything asynchronous subscribes `g.intent$` and dispatches the answer
when it arrives. See [Intents, changes, effects](/reference-actions).

## The gesture epics share one operator

Resize, column move, and row move are the same `drag` in `src/6_gestures.ts`, which is `switchMap`
into a move stream ended by the pointer coming up, merged with the commit. The three differ only in
the hit test. `setDragStreams` in `src/6_gestures.ts` swaps the live pointer source for subjects and
returns the restore function, which is how every drag case runs with no window.
