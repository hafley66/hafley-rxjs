# Everything table

Every implemented feature switched on at once, over fifty thousand leaves or a tree of roughly the
same size, with a control panel and a live readout.

<p><a href="./demo/everything" target="_blank" rel="noreferrer">Open the route full screen</a></p>

## What it is stressing

A stage that works alone and breaks beside another one shows up as a torn frame rather than as a
passing unit case. Sorting, grouping, tree expansion, selection, pinning on both axes, a composite
cell, paging, virtualization, density, and keyboard navigation all run together.

## What you can drive

| control | writes |
| --- | --- |
| sort and multi-sort | `state.sort` |
| group keys | `state.group` |
| expansion | `state.expanded` |
| selection | `state.rowSelection` and `state.selection` |
| pinning | `state.rowPinning` and `state.colPinning` |
| paging mode | `state.page` |
| virtualization, density, list view | `state.virtualize.vertical`, `state.density`, `state.listView` |

Preset states are plain data in `demo/scenarios.ts`, so a scenario is one state write rather than a
script.

## The readout

Relation sizes, the numbers on the derived plan, DOM element counts, and a log of the action bus.
Watching the DOM count stay flat while the row count climbs is the virtualization claim, live.

## From the console

```js
__grid.state.density.$("compact")
__grid.view.plan.$().span
__demo.applyScenario("Everything")
```

`window.__grid` is the active route's grid, and `window.__sg` holds the constructor, the renderer,
and the signal factory, so a console session can build another grid beside it.

## Defects this route reproduces

| defect | the workaround it carries |
| --- | --- |
| `ColumnDef.pin` seeds nothing, because the kernel never calls `pinningFor` | the route calls it and writes `state.colPinning` itself |
| `ColumnDef.movable` is read by the renderer and absent from the type | the move grip is stamped from a header slot |

The about card at the top of the route lists the feature ids it exercises, read from `src/features.ts`,
so a renamed feature fails the build rather than the prose.
