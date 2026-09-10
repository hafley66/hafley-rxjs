# Virtualization

Render only the rows the viewport can show, and turn that off with one write when you want the whole
list in the document.

<GridDemo id="virtualization-50k" />

## The switch

```ts
g.state.virtualize.$(false)
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

## Column virtualization

Not wired. The same `windowOf` on the other axis is what it would be, and no code calls it, so every
visible column renders whatever the horizontal scroll position.

## Measured content

`src/14_measure.ts` carries one resize observer per store, an estimate for unmeasured rows, a buffer
zone, and scroll anchoring, which is the path for rows whose height you cannot declare. Declared
heights are on [Height](/rows-height).
