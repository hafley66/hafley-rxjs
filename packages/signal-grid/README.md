# @hafley66/signal-grid

Build a sortable, groupable, tree-shaped, virtualized data grid whose rows and columns are the same
kind of object, and drive all of it by writing signals.

```sh
pnpm add @hafley66/signal-grid @hafley66/signals @hafley66/path @hafley66/xdom rxjs
```

```ts
import { grid, render } from "@hafley66/signal-grid"
import "@hafley66/signal-grid/theme.css"

const g = grid<Row>({ id: "files", rows: ROWS, columns: COLUMNS, rowId: (it) => it.id })
render(g, host)

g.state.sort.$([{ field: "size", sort: "asc" }])
g.view.flat.$().map((it) => it.key)
```

No subscription, no `onChange`, no provider. A computed signal recomputes when you read it, so a
stage is asserted by calling it.

## The one idea

Rows are an `Axis<RowId, TRow>` and columns are an `Axis<ColId, ColumnDef>`, both ordered forests
with the same interface (`src/0_types.ts`). A flat list is the case where every key is a root, and a
column header group is a parent edge, so list data, tree data, and header nesting run one code path.

| operator in `src/1_axis.ts` | serves |
| --- | --- |
| `sortAxis` | row sort and multi-column sort |
| `groupAxis` | row grouping |
| `flattenAxis` | tree data, expansion, and the column forest |
| `filterAxis` | nothing today; filtering is cut |
| `mapAxis` | nothing today; structure is shared by reference |

Two more keep the same identity-by-reference convention: `withDetail` (`src/11_detail.ts`) inserts
one panel node per open row, and `renderPlan` (`src/4_slice.ts`) runs partition, paginate, and
window, in that order and once.

Because both axes are one container, which axis scrolls is a state key rather than a code path.
Writing `state.orientation` transposes the grid, and `src/` holds no branch on it.

## Where to go

| you want | page |
| --- | --- |
| a running grid in ten lines | [Your first grid](/first-grid) |
| the rules the whole surface follows | [The five laws](/five-laws) |
| sorting, grouping, trees, pinning, selection | the Rows group |
| pagination, infinite scroll, server mode | the Loading rows group |
| the constructor, the state shape, the action grammar | the Reference group |
| why it is shaped this way | the Why group |
| bundle size, benchmarks, filmed proof | the Receipts group |

## What is not built

| gap | evidence |
| --- | --- |
| filtering, quick filter, filter logic | `filterAxis` has no call site, and `GridState` carries no `filter` key |
| a header group band | `view.cols` carries the group node and the renderer drops it before the header is built |
| inline editing, column typing, aggregation | cut by decision, listed on the parity page |
| `rowOrder` | a state key with no reader in `src/` |

The generated three-way feature matrix is `docs/1_parity.md`, rebuilt by `pnpm parity`.
