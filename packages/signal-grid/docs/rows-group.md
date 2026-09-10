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

## Reading a group row

`FlatNode` carries the depth and the key, and a group key is prefixed to keep it off real row ids.

| thing | value |
| --- | --- |
| the prefix | `GROUP_PREFIX` in `src/0_types.ts` |
| the operator | `groupAxis` in `src/1_axis.ts` |
| whether a column may be grouped | `groupable` on `ColumnDef` |

The operator rebuilds the forest above the data edges rather than bucketing a flat list, so a
grouped tree keeps every unit travelling with its own subtree. That costs measurable time at large
row counts, and the number is on [Two ordered forests](/why-forests).

## What grouping does not do

Aggregation is cut. No `FeatureId` implements it, and nothing sums, counts, or averages a group.
A heading carries its key and its children, with no computed footer value of any kind.

If you want a total per group, compute it in your own data and read it from a slot on the heading
row. See [Slots](/cells-slots).

## Server mode

Under `mode: "server"` grouping is the identity and the keys are published on `g.query` for the
caller to send upstream. See [Server mode](/page-server).
