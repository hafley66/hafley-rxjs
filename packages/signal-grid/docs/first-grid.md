# Your first grid

Three arguments build a working grid: the rows, the columns, and how to name a row. Everything else
on this site is a state key written on top of that.

<GridDemo id="flat-list" />

## The call

```ts
import { grid, render, type ColumnDef } from "@hafley66/signal-grid"
import "@hafley66/signal-grid/theme.css"

interface Row {
  readonly id: string
  readonly name: string
  readonly size: number
}

const COLUMNS: readonly ColumnDef<Row>[] = [
  { id: "name", header: "Name", flex: 2, minWidth: 140 },
  { id: "size", header: "Size", width: 120 },
]

const g = grid<Row>({ id: "files", rows: ROWS, columns: COLUMNS, rowId: (it) => it.id })
const handle = render(g, document.querySelector("#host")!)
```

`render` returns a handle, and `handle.stop()` releases every subscription the grid opened.

## Reading a stage

Each stage of the derivation is a signal you call. No subscription is needed, because a computed
recomputes when you read it.

```ts
g.view.flat.$().map((it) => it.key)   // the row keys in view order
g.view.plan.$().center                // the keys that actually render
g.view.cols.$().map((it) => it.key)   // the column keys after hide and reorder
```

## Writing a stage

State is one signal reached by proxy dots. A write lands and the view is correct on the next read.

```ts
g.state.sort.$([{ field: "size", sort: "asc" }])
g.state.colHidden.size.$(true)
g.state.density.$("compact")
```

There is no `onChange` prop anywhere in the package, because a signal already carries both halves.
The argument for that is at [Signals instead of value and onChange](/why-signals).

## The three pieces you just used

| piece | what it is | where it lives |
| --- | --- | --- |
| `grid()` | the constructor returning state, view, and streams | `src/8_grid.ts` |
| `render()` | the optional plain-DOM renderer, which calls `bind` for you | `src/10_render.ts` |
| `ColumnDef` | reading, sizing, capability flags, and the two per-column slots | `src/0_types.ts` |

## Next

[The five laws](/five-laws) states the rules the rest of the surface follows.
