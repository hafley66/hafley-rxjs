# Group

Collapse rows under one heading per distinct value, nesting a second level under the first by adding
a second key.

<GridDemo id="row-grouping" />

## Write the keys

`state.group` is an ordered list of column ids. The first id is the outer level.

```ts
g.state.group.$(["kind"])
g.state.group.$(["kind", "owner"])
g.state.group.$([])            // back to a flat list
```

A group heading is a synthetic row, so it expands and collapses through the same `state.expanded`
record as tree data.

```ts
g.state.expanded.$({ "g:kind:audio": true })
```

## What a heading draws

A group row is one box across the row rather than a cell per column, the same shape a detail panel
takes. Every column beside it would draw an empty cell, which reads as a row whose fields are
missing.

| part | class | what it holds |
| --- | --- | --- |
| the expander | `.sg-expander` | opens and closes the level |
| the field | `.sg-group-field` | the grouped column's `header`, drawn only when a second level is open |
| the value | `.sg-group-value` | the last element of `path`, which is what this level grouped by |
| the count | `.sg-group-count` | data rows in the whole subtree, from `groupCounts` in `src/1_axis.ts` |

The row carries `data-group="true"` and no `.sg-cell`, so a cell range drag never stamps one.

## Reading a group row

`FlatNode` carries the depth and the key, and a group key is prefixed to keep it off real row ids.
The value behind that key is a `GroupRow`, and `isGroupRow` narrows it, which is what the renderer
tests rather than testing the key at each cell.

```ts
import { isGroupRow } from "@hafley66/signal-grid"

const value = g.view.sorted.$().by.get(key)
if (isGroupRow(value)) console.log(value.path) // ["document", "ana"]
```

| thing | value |
| --- | --- |
| the prefix | `GROUP_PREFIX` in `src/0_types.ts` |
| the guard | `isGroupRow` in `src/0_types.ts` |
| the operator | `groupAxis` in `src/1_axis.ts` |
| the subtree counts | `groupCounts` in `src/1_axis.ts` |
| whether a column may be grouped | `groupable` on `ColumnDef` |

## Replacing the heading

`Slots.groupRow` is the same door every other rendered part uses. It receives a `GroupCtx`, and what
it returns replaces the built-in field, value, and count. The expander stays, because a level with
nothing to open it is a level that cannot close.

```ts
const g = grid<Row>({
  ...,
  slots: {
    groupRow: (ctx) => `${ctx.header ?? ctx.field}: ${String(ctx.value)} (${ctx.count})`,
  },
})
```

The operator rebuilds the forest above the data edges rather than bucketing a flat list, so a
grouped tree keeps every unit travelling with its own subtree. That costs measurable time at large
row counts, and the number is on [Two ordered forests](/why-forests).

## What grouping does not do

Aggregation is cut. No `FeatureId` implements it, and nothing sums or averages a group. The heading
counts the rows under it and computes nothing else.

If you want a total per group, compute it in your own data and read it from `Slots.groupRow`.

## Server mode

Under `mode: "server"` grouping is the identity and the keys are published on `g.query` for the
caller to send upstream. See [Server mode](/page-server).
