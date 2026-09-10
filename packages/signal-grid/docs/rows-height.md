# Height

Give one row its own height while the rest fall through to the density default, and keep scrolling
accurate while you do it.

<GridDemo id="row-height" />

## The state

```ts
g.state.rowHeight.r3.$(72)
g.state.rowHeight.$({ r3: 72, r9: 120 })
g.state.rowHeight.r3.$(undefined)   // back to the default
```

The default comes from density, covered on [Density](/view-density).

## What an override costs

The window has to know where every row starts, and a uniform height makes that arithmetic. One
override makes it a lookup.

| sizer | cost per lookup | chosen when |
| --- | --- | --- |
| `uniformSizer` in `src/4_slice.ts` | constant | no key in the run carries an override |
| `measuredSizer` in `src/4_slice.ts` | a prefix sum with a binary search | any key in the run carries one |

`sizerFor` in `src/8_grid.ts` picks between them, and it looks at the page run rather than the whole
list, so an override on a row you paged away costs nothing.

## The pixels

A height reaches the DOM as a custom property named after the row, encoded to a valid identifier by
`encodeVarId` in `src/3_paths.ts`. The generic rule cannot spell that name, so the element also
carries a short alias the stylesheet reads.

```
--sg-r-h-<encoded row id>   the value, written by the property writer
--sg-h                      the per-row alias a rule can match
```

`writeGridVars` in `src/9_css.ts` writes one pass per frame and drops a property whose row left the
plan, so the sheet never grows without bound while you scroll.

## Detail panels

A detail panel is a row, so its height is a `rowHeight` entry like any other. `detailHeights` in
`src/11_detail.ts` writes those entries for you. See [Detail rows](/rows-detail).

## Measuring instead of declaring

`src/14_measure.ts` holds one resize observer per store, an estimate, a buffer zone, and scroll
anchoring, which is the path for content whose height you cannot know in advance.
