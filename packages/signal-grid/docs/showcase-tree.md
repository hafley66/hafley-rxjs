# Filesystem tree

A five-level tree over six volumes, six hundred and thirty-six directories, and fifty thousand
files, virtualized while it is expanded.

<p><a href="./demo/tree" target="_blank" rel="noreferrer">Open the route full screen</a></p>

## What it is stressing

Tree flattening and virtualization at the same time. Expanding everything makes the flat list far
longer than the document can hold, so the two stages have to agree on what index means at every
scroll position.

## Why the two are hard together

`flattenAxis` in `src/1_axis.ts` skips a closed node's whole subtree, so the visible list changes
length on every toggle. The window is computed over that list through a sizer built on the page run,
which means an expansion invalidates the offsets of every row after it.

The expand-all control is the sharpest case: one write, and the flat list grows by two orders of
magnitude while the rendered element count stays where it was.

## Features it exercises

Tree data, expansion, sort, per-row height, row virtualization, scroll position, density, and slots.

## What to watch in the readout

| number | what it tells you |
| --- | --- |
| the relation sizes | how many nodes the forest holds |
| the flat list length | how many are visible after expansion |
| the plan's center run | how many are candidates after pinning and paging |
| the DOM element count | how many actually exist |

The gap between the third and the fourth is the whole point of the window.

## Related pages

[Tree data](/rows-tree) and [Virtualization](/view-virtualize) cover the two halves at page scale,
each with a panel you can edit.
