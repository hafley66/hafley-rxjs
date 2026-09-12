# Order

Decide the left-to-right order of columns by writing an array, or let a header drag write it.

<GridDemo id="column-reorder" />

## Write the order

```ts
g.state.colOrder.$(["size", "name"])
g.view.cols.$().map((it) => it.key)
```

The array is a ranking rather than a complete list. A column the array does not name sorts to the
end, keeping its declaration order among the other unlisted ones, so adding a column to the schema
never requires editing the order key.

## Drag a header

```ts
g.dispatch(headerDown("name", "move", 0))
```

`moveColumnOnHeaderDrag` in `src/7_epics.ts` publishes where the column will land while the pointer
is down and writes `colOrder` once, on the lift. `landingIndex` in `src/6_gestures.ts` decides a
neighbour has been passed once the pointer crosses half of it, measured from where the drag began.

## Preview, or live

```ts
grid<Row>({ ...config, drag: "live" })     // rewrites colOrder on every pointermove
grid<Row>({ ...config })                   // "preview", the default
```

| mode | during the drag | on the lift |
| --- | --- | --- |
| `preview` | `state.drag` names the travelling column and the landing edge; no column moves | one `colOrder` write, then `state.drag` back to null |
| `live` | one `colOrder` write per pointermove | one more, from the last position |

`preview` is the default because a live rewrite moves the grid under the pointer that is aiming at
it, and because the rebuilt header band throws away the element the pointer grabbed: `buildHeader`
in `src/10_render.ts` tears the band down whenever `colRunSignature` changes, so `:active` on the
grip died on the second frame of every live drag. Deferring the commit is what lets the renderer
stamp `data-dragging` on the cell that is travelling, and draw the drop line at the landing edge.

`GridConfig.drag` is read only when `epics` is absent. A caller listing epics passes the mode to
`moveColumnOnHeaderDrag` and `resizeOnHeaderDrag` directly, since each takes it as its second
argument.

The grip is drawn when the column allows the move. `src/10_render.ts` reads that flag through a
local patch type, and the flag is absent from `ColumnDef` in `src/0_types.ts` today, so a schema
that wants a grip stamps one from a header slot. See [Slots](/cells-slots).

## One gesture, three hit tests

Resize, column move, and row move are the same `drag` operator in `src/6_gestures.ts`, which is
`switchMap` into a move stream ended by the pointer coming up, merged with the commit. The three
differ only in which part of the path the press landed on.

| press lands on | route | epic writes |
| --- | --- | --- |
| the header label | `g/h/move` | `drag` per move, `colOrder` on the lift |
| the resize handle | `g/h/resize` | `drag` per move, `colWidth` on the lift |
| the row grip | `g/r/move` | `drag` per move, an effect on the lift and nothing in state |

## Testing a drag with no window

`setDragStreams` in `src/6_gestures.ts` swaps the live pointer source for two subjects and returns
the restore function, which is how the drag suites run with no browser at all.
