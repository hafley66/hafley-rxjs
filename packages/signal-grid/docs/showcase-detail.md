# Master detail

Four hundred orders, each one opening a panel that holds a second grid over that order's lines,
fetched when the panel opens.

<RouteFrame route="detail" title="the detail route" />

## What it is stressing

A grid inside a grid, with the outer one virtualized. The nested grid has its own state, its own
epics, and its own teardown, and the outer one has to size the panel row correctly or the scroll
drifts.

## Two grids, two lifetimes

`withDetail` in `src/11_detail.ts` inserts one panel node per open row directly after that row, so
the panel is a row in the row index space and is windowed like any other. The nested grid is built
inside the detail slot, and its render handle has to be stopped when the panel closes.

```js
__demo.nested.state.sort.$([])
```

Sorting the nested grid from the console leaves the outer one alone, which is the property that
makes nesting safe: two grids share no state and no subscription.

## The workarounds it carries

| workaround | for |
| --- | --- |
| nested render handles held in a map and stopped from outside the slot | a slot has no teardown hook of its own |
| a local attach helper | the documented lazy-loading path called an export the package does not have |

## Lazy lines

Lines arrive on demand rather than with the orders. The fetch is driven off `g.intent$` and writes
the consumer's own source signal, which re-derives the forest. That shape is written out on
[Intents, changes, effects](/reference-actions).

## Features it exercises

Detail rows, tree data, expansion, sort, column pinning, column resize, slots, and row
virtualization.

## Related pages

[Detail rows](/rows-detail) mounts the same idea at page scale, with a panel you can edit.
