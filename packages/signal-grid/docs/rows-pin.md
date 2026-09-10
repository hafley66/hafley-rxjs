# Pin

Hold a row at the top or the bottom of the viewport while the rest scrolls, pages, and virtualizes
past it.

<GridDemo id="row-pinning" />

## The state

```ts
g.state.rowPinning.b.$("start")
g.state.rowPinning.z.$("end")
g.state.rowPinning.b.$(undefined)   // unpin
```

## What pinning guarantees

A pinned key is never paged away and never virtualized away. That is the meaning of the word, and it
is asserted rather than assumed.

```ts
g.state.rowPinning.b.$("end")
g.state.page.$({ mode: "pages", index: 0, size: 1, total: null })
g.view.plan.$().end        // ["b"], while center holds the page
```

## The plan

`renderPlan` in `src/4_slice.ts` runs three steps in a fixed order, and pinning is the first one.

| step | acts on | result |
| --- | --- | --- |
| `partition` | the flat list | three runs, `start`, `center`, `end` |
| `paginate` | the center run only | the page window |
| `windowOf` | the paginated center only | the visible slice |

Because pinning lifts rows out first, a flat-list index no longer names the same row inside the
center run, which is why the sizer is built over the page run rather than over the flat list.

## The same operator serves columns

`partition` in `src/4_slice.ts` takes an axis and a side lookup, so row pinning and column pinning
are one function called twice. `Side` is `start`, `center`, `end` on both axes. Column pinning is
on [Pin](/columns-pin) under Columns.

## What the renderer draws

Three run boxes, stamped `data-side` with the run name. A rule targeting `[data-side="start"]`
therefore styles the pinned band on either axis without knowing which axis it is.
