# Rows from an Observable

Feed the grid a live source and let every derived stage follow it, with an RxJS pipeline in front if
you want one.

<GridDemo id="observable-rows" />

## Four shapes of source

`GridSource<T>` accepts any of them, and `toGridSignal` in `src/8_grid.ts` normalises them.

| you pass | you get | reach for it when |
| --- | --- | --- |
| an array | a writable signal seeded with it | the rows are static |
| an Observable | a signal fed by it, holding the fallback until it emits | server or socket rows |
| a thunk | a computed that re-derives on any signal it read | rows derived from other state |
| a Signal | that same signal, adopted unchanged | two grids sharing one source, or a caller who wants to write |

```ts
grid<Row>({ id: "t", rows: rows$, columns, rowId })
grid<Row>({ id: "t", rows: () => source.$().filter(big), columns, rowId })
grid<Row>({ id: "t", rows: existing, columns, rowId })   // adopted, still writable by you
```

Adoption is by reference, so the signal you handed in is the signal the grid holds, and writing it
from outside is an ordinary write.

## A pipeline in front

`pipe$` puts RxJS operators between a source and the signal the grid reads.

```ts
grid<Row>({ id: "t", rows: source.$.pipe$(debounceTime(50), map(normalise)), columns, rowId })
```

It is both a method on the accessor and a free function over an Observable or a Signal, so the
pipeline can start on either side of the boundary.

## What stays a plain function

`rowId` and `subRows` are plain functions rather than sources, by decision. Row identity changing
reactively would invalidate selection, expansion, and pinning at once, which is a data reload rather
than a state change, and the grid has no way to tell those apart from the inside.

## Cost of a source change

A new array re-derives the whole chain, because the base forest is built from it. A stage that
compares equal by reference is skipped downstream, so an emission that changes nothing costs one
comparison per stage.

## Errors and completion

An Observable that errors leaves the last emitted value in place; the grid holds a signal and never
subscribes to your source twice. Completion is not a state the grid has an opinion about, so a
finite source simply stops updating.
