# Matrix

Eight regions by seven columns with the orientation transposed, live, and a span of two by three
becoming three by two as it flips.

<iframe class="route-frame" src="./demo/matrix" title="the matrix route"></iframe>

<p><a href="./demo/matrix" target="_blank" rel="noreferrer">Open the route full screen</a></p>

## What it is stressing

`state.orientation` set to columns, which is the layout whose first column holds what are normally
column headers. Pinning, resizing, sorting, and spanning all run inside the transposed frame.

## The span, flipped

A cell declaring two rows by three columns has to occupy three rows by two columns once the axes
swap. `neutralSpan` in `src/12_transpose.ts` crosses the declaration into a vertical count and a
horizontal count, and `coveredBy` in the same file recomputes which cells the span now hides.

Watching the covered set swap is the clearest demonstration that the transpose reaches the model
rather than the stylesheet.

## The workaround it carries

A cell reads its value out of the row axis's own map, and under a transposed orientation the
vertical key is a column id, which owns no row value. `demo/3_matrix.ts` therefore rewrites the
transposed header band after each pass and supplies its own cell content.

Copy that shape until the renderer crosses the seats itself. The state of the two halves is on
[The seat table](/why-seats).

## Features it exercises

List view, cell spanning, column pinning, column resize, row pinning, row sort, slots, and theming.

## Related pages

[List view and the transpose](/view-list) for the state keys, [Span](/cells-span) for the span
relation, and [The seat table](/why-seats) for why no stage branches on the orientation.
