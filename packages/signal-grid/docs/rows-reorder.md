# Reorder

Let a reader drag a row to a new position, and decide yourself what the new order means.

<GridDemo id="row-reorder" />

## The grip

```ts
const columns = [dragColumn(), ...DATA_COLUMNS]
```

`dragColumn` in `src/5_columns.ts` renders a handle carrying the row move route. Pressing it starts
the same gesture that resizes a column and moves a header, with a different hit test.

## The effect

A committed drag emits an effect and writes nothing. Your code owns the order.

```ts
runWhenInView(
  g.effect$.pipe(
    filter((it) => it.type === "reorderRow"),
    tap((it) => rows.$(moved(rows.$(), it.row, it.index))),
  ),
)
```

`moveRowOnRowDrag` in `src/7_epics.ts` emits on commit only, so a drag that is abandoned mid-flight
changes nothing. `landingIndex` in `src/6_gestures.ts` decides a neighbour is passed once the
pointer crosses half of it, measured from where the drag began.

## The preview

While the pointer is down the epic writes `state.drag`, and nothing else moves.

```ts
g.state.drag.$()   // { kind: "rowMove", row: "r7", over: "r3", side: "start" }
```

| what is drawn | element | attribute |
| --- | --- | --- |
| the travelling row | `.sg-row` | `data-dragging="true"` |
| the landing edge | `.sg-guide` | `data-axis="block"`, offset in `--sg-guide-y` |

The rows hold still: the grid does not own source order, so there is nothing for it to shift, and
the line says where the drop will land before the consumer is asked to rewrite anything. A landing
row the window does not hold draws no line, because there is nothing on screen to draw it against.
Columns and the resize handle carry the same pair behind `GridConfig.drag`, on
[Order](/columns-order) and [Resize and width](/columns-width).

## Why the grid does not rewrite your rows

The rows signal is yours. Reordering it inside the kernel would mean the grid holding an opinion
about identity, ordering, and persistence for data it did not create. Emitting the intended index
leaves all three with the code that owns the array.

## The inert state key

`GridState` declares `rowOrder`, and nothing in `src/` reads it. Writing it changes no rendered
output today. Treat the effect above as the whole reorder surface.

## Interaction with sort

A sorted grid derives its order from the comparator, so a manual reorder that writes the source
array is overwritten on the next derivation. Clear the sort model before offering a drag, or apply
the effect to a stored rank field the comparator reads.
