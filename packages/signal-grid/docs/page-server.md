# Server mode

Hand the grid a page the server already sorted, and read back the descriptor saying what to fetch
next.

<GridDemo id="server-mode" />

## The switch

```ts
const g = grid<Row>({
  id: "files",
  mode: "server",
  rows: PAGE,
  columns: COLUMNS,
  rowId: (it) => it.id,
  rowCount: 400,
})
```

`rows` is now the page rather than the corpus, and `rowCount` is the total the server reports.

## What the kernel stops doing

| stage | client | server |
| --- | --- | --- |
| group | runs | identity, published in `g.query` |
| sort | runs | identity, published in `g.query` |
| paginate | runs | published in `g.query`; `rows` is already the page |
| detail, tree flatten, pinning, virtualization, selection | runs | runs |

Sorting the model no longer reorders anything locally, which is the point: the server's order is the
answer, and re-sorting it would fight whatever collation the database used.

```ts
g.state.sort.$([{ field: "size", sort: "asc" }])
g.view.flat.$().map((it) => it.key)   // still the server's order
```

## The descriptor

`g.query` is a signal carrying everything the caller must send upstream.

```ts
g.query.$()
// { sort, group, page: { mode, index, size, total }, expand: null }
```

Driving a fetch is subscribing to it.

```ts
g.query.$.subscribe((it) => fetchPage(it).then((page) => rows.$(page.rows)))
```

The total is copied in from `rowCount`, so the page descriptor is complete without a second read.

## The expand hole

`query.expand` is hardcoded to nothing, so lazy server-side tree loading has no trigger inside the
kernel. Drive it off `g.intent$` instead, which is on
[Intents, changes, effects](/reference-actions).

## Filtering

There is no filter model to publish, because filtering is cut on both sides. `filterAxis` in
`src/1_axis.ts` and `buildRowPredicate` in `src/2_operators.ts` are written, tested, and called by
nothing, and `GridState` carries no filter key. The reasoning is on
[Alternatives rejected](/why-alternatives).
