# Million-row sheet

One million rows and 240 columns, both seats of the window switched on, and the rows minted from
their index rather than stored.

<RouteFrame route="sheet" title="the sheet route" />

## What it is stressing

240,000,000 cells exist in the model. 308 of them stand in the document at the viewport this
route's own chromium test mounts, which is 22 rows by 14 columns. A grid that windows only rows
would put 240 cells in the document per rendered row and drop frames the moment the scroll went
sideways.

## Where the rows come from

`demo/5_sheet.ts` hands `grid()` a proxy over an empty array: `length` answers 1,000,000 and an
index answers `{ id, at }` built on the spot. `Array.isArray` still holds and `map` still walks it,
so no array of a million objects is ever held by the demo.

Every cell value is a function of the row's index and the column's, so the 240,000,000 values exist
without one of them being stored.

## What the panel reports

| readout | what it answers |
| --- | --- |
| rows, columns, cells | the size of the model |
| rendered rows, columns, cells | the size of the document |
| model cells per rendered cell | the ratio those two make |
| frames per second | sampled every 500 ms off `requestAnimationFrame` |
| scroller height | the pixels the spacer asks for, against the engine's ceiling |

## The ceiling this route pins itself to

A million rows at the standard 36 px density asks a scroller for 36,000,000 px, and the engine
stops near 33,554,432. The route runs at compact, 28 px, for a 28,000,028 px scroller, and offers no
density control, because switching to comfortable would put the last rows out of reach of the
scrollbar.

## What it costs

Measured by the probe in `scripts/stats.mjs`, run at both counts with the rows pre-allocated so the
two are comparable: 126.5 bytes retained per row at 100,000 rows, 114.7 at 1,000,000. The figure
holds, and it falls slightly, because the fixed cost of one grid is spread over ten times the rows.

## What holds it up

`demo/5_sheet.test.ts` mounts this route in chromium, scrolls it to eight stops including both far
corners, and asserts the rendered cell count stays under 1,200 at every one of them while the first
rendered row keeps changing.

## Related pages

[Virtualization](/view-virtualize) for the two seats and the state key behind them, and
[The seat table](/why-seats) for why one windowing serves both.
