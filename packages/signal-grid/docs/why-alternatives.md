# Alternatives rejected

Four shapes were considered and dropped. Each one is recorded with what was kept from it, which for
three of them is nothing.

## A row pipeline plus a flat column list

The shape both comparable libraries take. Rejected because the transpose becomes a second code path:
every stage that reads a row would need a column twin, and the branch on orientation would appear
once per stage instead of never.

The one-axis shape also forces header nesting into a separate pass, which is a dedicated builder in
one library and a separate grouping model in the other. Here the column axis is already a forest, so
nesting is `flattenAxis` in `src/1_axis.ts` called with a predicate that always answers open.

Kept from it: nothing. The bill is the cost table on [Two ordered forests](/why-forests).

## A pixel width solver in the package

Rejected and deleted, with the measurement behind it and the consequence spelled out on
[No layout algorithm](/why-no-solver).

Kept from it: the declared width, minimum, maximum, and flex keys on `ColumnDef`, which are now
constraints handed to the layout engine rather than inputs to arithmetic.

## Filtering inside the kernel

`filterAxis` in `src/1_axis.ts` and `buildRowPredicate` in `src/2_operators.ts` are written, tested,
and called by nothing. `GridState` carries no filter key, so a filter model would be state that no
stage reads.

The reason is recorded inside the parity generator rather than in prose, so the matrix cannot
disagree with it, and tagging the row filter feature as implemented fails the parity run.

Kept from it: both functions, and `FilterMode` in `src/0_types.ts`, which exists because a tree
filter has three defensible answers: prune the tree, keep ancestors, or keep whole subtrees. Picking
one of the three without a caller would have been the actual mistake.

## Aggregation, column typing, and inline editing

| cut | why |
| --- | --- |
| aggregation | arithmetic over a group rather than a relational operator; a group heading carries its key and its children and nothing else |
| column typing as a driver | `ColumnType` reaches the comparator and the operator set and stops there |
| inline editing | the consumer owns the form lifecycle; `state.editing` is read by the renderer and written by no epic |

Each one carries its reason in the same generator, so the parity matrix and this page cannot drift
apart.

## What is available and unused

| thing | state |
| --- | --- |
| `mapAxis` in `src/1_axis.ts` | written, no caller; structure would be shared by reference |
| `ancestorsOf` in `src/1_axis.ts` | reached only through `filterAxis`, which has no caller |
| `rowOrder` | a state key with no reader |
| `query.expand` | hardcoded to nothing, so server tree loading has no kernel trigger |
| column virtualization | not attempted; it is the same window on the other axis |

## Still unwired in the renderer

| gap | where it stops |
| --- | --- |
| the header group band | `src/10_render.ts` drops group nodes before the header is built |
| eight declared slots | `headerGroup`, `row`, `checkbox`, `resizeHandle`, `dragPreview`, `empty`, `loading`, `footer` |
| a focus ring | `state.focus` has no renderer |
| the transposed cell values | a cell reads from the row axis's map, covered on [The seat table](/why-seats) |

The generated three-way matrix is on [Feature parity](/parity), and it is rebuilt from the tags in
`src/` rather than written by hand.
