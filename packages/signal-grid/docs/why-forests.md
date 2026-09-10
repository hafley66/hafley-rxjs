# Two ordered forests

Rows and columns are the same container, so every structural operator is written once and called
twice.

```ts
Axis<RowId, TRow>          // the rows
Axis<ColId, ColumnDef>     // the columns
```

`Axis<K, T>` carries `roots`, `children`, `parent`, and `by`, and is declared in `src/0_types.ts`.
A flat grid is the case where every key is a root, and a column header group is a parent edge.

## The usual shape, beside this one

| | a typical grid | this package |
| --- | --- | --- |
| rows | a pipeline of row models | one ordered forest |
| columns | an array plus a separate grouping model | the same ordered forest |
| the operators | one set per axis | five pure ones in `src/1_axis.ts`, shared |
| which axis scrolls | fixed when the library was written | `state.orientation`, read through a lookup table |

## What one container buys

| claim | receipt |
| --- | --- |
| One flatten serves tree rows and header groups. `flattenAxis` is called with the real expansion predicate for rows and with a predicate that always answers open for columns. | two call sites in `src/8_grid.ts` |
| One partition serves row pinning and column pinning, with `start`, `center`, `end` on both. | `partition` in `src/4_slice.ts` |
| A flat list and a tree run one path, because a flat grid is a forest whose every key is a root. | `axisOfEntries` and `axisOfTree` in `src/1_axis.ts` |
| A cyclic parent map does not throw. A node standing on a cycle becomes a root. | `axisOfEntries` in `src/1_axis.ts`, with cycles among the cases in `src/1_axis.test.ts` |
| Identity by reference is the skip condition, so a downstream stage compares and does nothing. | every operator in `src/1_axis.ts` returns its input when it changed nothing |

## Measured

| what | this package | the comparison |
| --- | --- | --- |
| a no-write read of the derived list | 0.000137 ms | 0.000454 ms |
| expanding a large tree at one tenth open | 0.214 ms | 0.651 ms |

Both rows are recorded with their method and their machine in `bench/README.md`.

## What it costs

| cost | receipt |
| --- | --- |
| No per-row and per-column handle objects. A key-and-map container answers with map lookups where the alternatives hand back a row object carrying its own methods. | `docs/3_competitors.md` |
| Grouping is slower, because `groupAxis` rebuilds the forest above the data edges so a unit travels with its own subtree. At a hundred thousand rows that is 45.0 ms against 32.9 ms. | `bench/README.md` |
| `axisOfEntries` is quadratic on a path-shaped relation, which a flat relation and `axisOfTree` never reach. | `bench/README.md` |
| Two vocabularies meet at one file, and a span declared in rows and columns has to be crossed into neutral counts. | `neutralSpan` in `src/12_transpose.ts` |
| `renderPlan` is linear in the row count per scroll tick, virtualized or not. | `bench/README.md` |

## The payoff

Because both axes are one container, transposing the grid is a state write rather than a second
rendering path. That argument is on [The seat table](/why-seats).
