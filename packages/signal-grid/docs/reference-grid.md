# grid()

Construct a grid from a configuration object and get back state, a derived view chain, and an action
bus. Everything else in the package is reached through what this call returns.

```ts
import { grid } from "@hafley66/signal-grid"

const g = grid<Row>({ id: "files", rows: ROWS, columns: COLUMNS, rowId: (it) => it.id })
```

`grid()` is declared in `src/8_grid.ts`.

## Configuration

| key | type | accepts |
| --- | --- | --- |
| `id` | `GridSource<string>` | the grid id every path template interpolates |
| `rows` | `GridSource<readonly TRow[]>` | array, signal, observable, or thunk; the fallback is empty |
| `columns` | `GridSource<readonly ColumnDef<TRow>[]>` | the same four shapes |
| `rowId` | `(row: TRow) => RowId` | a plain function, deliberately not a source |
| `subRows` | `(row: TRow) => readonly TRow[] \| undefined` | present means tree mode |
| `mode` | `"client" \| "server"` | defaults to client |
| `rowCount` | `GridSource<number \| null>` | the server total, copied into the published page |
| `state` | `GridSource<Partial<GridState>>` | the first value seeds, every later one lands as a change per key |
| `sync` | `string \| boolean` | a url query key; `true` uses the grid id |
| `slots` | `Slots<TRow>` | covered on [Slots](/reference-slots) |
| `viewport` | `GridSource<Viewport>` | top, left, width, height; drives the window |
| `overscan` | `number` | rows padded on each side of the window |
| `epics` | `readonly GridEpic<TRow>[]` | absent installs the default list |

Four source shapes are normalised by `toGridSignal` in `src/8_grid.ts`, which adopts an existing
signal unchanged. See [Rows from an Observable](/page-observable).

## What comes back

| member | type | note |
| --- | --- | --- |
| `id`, `rows`, `columns`, `viewport` | signals | the adopted inputs |
| `mode` | `GridMode` | a plain value, fixed at construction |
| `state` | `Signal<GridState>` | one signal, nested writes through proxy dots |
| `view` | a record of computed signals | the derivation chain below |
| `actions$`, `intent$`, `change$`, `effect$` | Observables | one bus, split by phase |
| `query` | `Signal<QueryDescriptor>` | what a server must be sent |
| `page$` | `Observable<PageRequest>` | one emission per page change |
| `dispatch` | `(action) => void` | reduces a change and re-broadcasts every phase |
| `epics$` | `Observable<never>` | subscribing runs the epics |
| `bind` | `(root: HTMLElement) => () => void` | delegated listeners plus keydown, returns the teardown |
| `slots`, `rowId` | passthrough | as configured |

## The view chain

| stage | type | produced by |
| --- | --- | --- |
| `view.base` | `Axis<RowId, TRow>` | `axisOfEntries` or `axisOfTree` |
| `view.grouped` | the same | `groupAxis`, identity in server mode |
| `view.sorted` | the same | `sortAxis`, identity in server mode |
| `view.detailed` | the same | `withDetail`, one node per open panel |
| `view.flat` | `readonly FlatNode<RowId>[]` | a depth-first walk honouring expansion |
| `view.plan` | `RenderPlan<RowId>` | pinning, then paging, then the window |
| `view.cols` | `readonly FlatNode<ColId>[]` | the column forest after hide and reorder |
| `view.widths` | `ReadonlyMap<ColId, number>` | declared widths |
| `view.vertical`, `view.horizontal` | `AxisFacet` | the seat pair for the current orientation |
| `view.spans`, `view.covered` | the span relation and the covered set | crossed into neutral counts |

Each one is a computed signal, so reading a stage runs exactly the work that stage needs and no
subscription is involved.

## The two impure calls

```ts
const stop = g.bind(root)
const handle = render(g, root)
handle.stop()
```

`render` in `src/10_render.ts` calls `bind` itself. The kernel never needs a document to be correct,
which is why every unit test in `src/8_grid.test.ts` reads the chain with no DOM at all.

## Persisting state

`sync` swaps the plain state signal for one backed by `storageSignal(urlAdapter(key))`, so the whole
of `GridState` round-trips through the url. That is the reason a consumer key cannot be added to the
state type. See [GridState](/reference-grid-state).
