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

`moveColumnOnHeaderDrag` in `src/7_epics.ts` writes `colOrder` while the pointer moves, so the
header band and every row band travel together. `landingIndex` in `src/6_gestures.ts` decides a
neighbour has been passed once the pointer crosses half of it, measured from where the drag began.

The grip is drawn when the column allows the move. `src/10_render.ts` reads that flag through a
local patch type, and the flag is absent from `ColumnDef` in `src/0_types.ts` today, so a schema
that wants a grip stamps one from a header slot. See [Slots](/cells-slots).

## One gesture, three hit tests

Resize, column move, and row move are the same `drag` operator in `src/6_gestures.ts`, which is
`switchMap` into a move stream ended by the pointer coming up, merged with the commit. The three
differ only in which part of the path the press landed on.

| press lands on | route | epic writes |
| --- | --- | --- |
| the header label | `g/h/move` | `colOrder` |
| the resize handle | `g/h/resize` | `colWidth` |
| the row grip | `g/r/move` | an effect, and nothing in state |

## Testing a drag with no window

`setDragStreams` in `src/6_gestures.ts` swaps the live pointer source for two subjects and returns
the restore function, which is how the drag suites run with no browser at all.
