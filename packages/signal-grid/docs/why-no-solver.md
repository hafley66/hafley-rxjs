# No layout algorithm

The package computes no pixel widths. It emits one track list and the browser distributes, which is
both smaller and faster than the solver it replaced.

## What was deleted

A width solver resolved declared width, minimum, maximum, and flex into pixels against the viewport
width, on every derivation. It is gone.

## What replaced it

`trackList` in `src/4_slice.ts` emits one `grid-template-columns` value using `fr` and `minmax()`,
written to a custom property by `src/9_css.ts`. The layout engine does the division.

```
grid-template-columns: minmax(80px, 220px) 2fr 1fr
```

## The measurement that motivated it

A resize drag writes the column width once per pointer move, and each write used to re-sort the
whole row pipeline. After the fix, one width write at a hundred thousand rows costs 0.0126 ms, with
the method and the machine recorded in `bench/README.md`.

Two causes sat behind that, both in the signals library rather than in this package: a nested-path
write woke every other branch's subscriber, and the selector had no shallow comparison. Both are
fixed there, which is why `g.state.colWidth.name.$(300)` now touches one column.

## What it costs

Nothing in the package can know what a flex column ends up occupying without measuring the document.

```ts
g.view.widths.$().get("name")     // the declared width
element.getBoundingClientRect()   // the painted one
```

`view.widths` reports declared widths and says so in its own comment. A caller wanting the painted
width reads the element, which is the honest answer rather than a second solver that would have to
agree with the browser.

## Why this is the right trade

| a solver in the package | the track list |
| --- | --- |
| duplicates the layout engine's arithmetic, and has to keep agreeing with it | states the constraint once and lets the engine answer |
| runs inside the reactive chain, so a drag re-derives it per pointer move | runs in layout, off the reactive chain entirely |
| owns rounding, sub-pixel, and overflow behaviour | inherits whatever the platform does |
| reports a number that may disagree with the paint | reports the declaration, and points at the element for the paint |

## Row heights are the mirror case

A row height is a declaration too, and the sizer turns declarations into offsets rather than
measuring. Content whose height cannot be declared goes through `src/14_measure.ts`, which holds one
resize observer per store, an estimate, a buffer zone, and scroll anchoring. See
[Height](/rows-height).
