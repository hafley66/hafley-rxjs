# Sort

Order rows by one column or by several, either by writing the model or by letting a header click
write it for you.

<GridDemo id="multi-sort" />

## Write the model

The model is an array, and its order is the key order. First entry breaks ties last.

```ts
g.state.sort.$([{ field: "size", sort: "asc" }])
g.view.flat.$().map((it) => it.key)

g.state.sort.$([
  { field: "kind", sort: "asc" },
  { field: "size", sort: "desc" },
])

g.state.sort.$([])   // back to source order
```

## Let the header write it

A plain click cycles one column ascending, descending, then off. A shift-click appends a key,
keeping the ones already in the model.

```ts
g.dispatch(header("name"))
g.dispatch(header("size", { shift: true }))
```

The epic drops a column rather than storing a third direction, so an off state and an absent column
are the same state. That epic is `sortOnHeaderClick` in `src/7_epics.ts`, and dropping it from
`config.epics` gives you a grid whose headers do nothing.

## What runs underneath

| stage | what it does | where |
| --- | --- | --- |
| the model | an array of field and direction | `GridState` in `src/0_types.ts` |
| the comparator | folds the whole model into one function | `buildComparator` in `src/2_operators.ts` |
| the operator | reorders sibling lists, leaving parents in place | `sortAxis` in `src/1_axis.ts` |

Sorting is a sibling reorder rather than a flat re-list, which is what keeps a sorted tree a tree:
children stay under their parent and the depth-first walk still produces the visible order.

An empty model returns the input axis by reference, so every downstream stage compares with `===`
and skips its own work.

## Per-column control

| `ColumnDef` key | effect |
| --- | --- |
| `sortable` | whether a header click writes a key for this column |
| `type` | picks the default comparator through `comparatorFor` |
| `sortComparator` | replaces the comparator for this column |

## Server mode

Under `mode: "server"` the operator is the identity and the model is published for the caller to
send upstream. See [Server mode](/page-server).
