# Virtualization

Render only the rows the viewport can show, and turn that off with one write when you want the whole
list in the document.

<GridDemo id="virtualization-50k" />

## The switch

`virtualize` carries one flag per seat, keyed the way `CellSpan` is keyed. `vertical` gates the run
that scrolls and pages, `horizontal` gates the run across the page, and `orientation` decides which
axis is sitting in each seat.

```ts
g.state.virtualize.vertical.$(false)
g.view.plan.$().center     // every row in the page
```

Off makes the window step the identity. Every other stage runs exactly as before, which is the
property that makes the toggle safe to flip in a test: the plan changes size and nothing changes
shape.

## What the window needs

| input | source |
| --- | --- |
| the viewport box | `config.viewport`, a source of top, left, width, and height |
| the sizer | `sizerFor` in `src/8_grid.ts`, built over the page run |
| the padding | `config.overscan`, rows added on each side of the visible slice |

`windowOf` in `src/4_slice.ts` turns those into an index range, and the kernel below it is a pure
function of that range. Overscan lives in the viewport-to-range step for that reason, so no stage
downstream has to know the window was padded.

## The viewport is yours to feed

`grid()` subscribes to no producer for the viewport, so a scroll listener or a resize observer
writing that source is consumer glue. `render` wires the common case for you.

## Why the sizer is built over the page run

Pinning lifts rows out of the middle and paging drops others, so an index into the flat list names a
different row than the same index into the run being windowed. Building the sizer over the page run
keeps the arithmetic honest at the only place the pixels are used.

## The other seat

`g.state.virtualize.horizontal.$(true)` runs the same `renderPlan` over the horizontal run, which
`src/8_grid.ts:544` builds as `colPlan`. It is off by default, because a schema narrow enough to fit
pays the two spacer tracks for nothing.

Under `orientation: "columns"` the vertical seat holds columns and the horizontal seat holds rows, so
neither flag is named after an axis: the seat is what each one gates.

## Measured content

`src/14_measure.ts` carries one resize observer per store, an estimate for unmeasured rows, a buffer
zone, and scroll anchoring, which is the path for rows whose height you cannot declare. Declared
heights are on [Height](/rows-height).
