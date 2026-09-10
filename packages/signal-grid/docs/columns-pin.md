# Pin

Hold a column at the leading or trailing edge while the rest scroll sideways under it.

<GridDemo id="column-pinning" />

## The state

```ts
g.state.colPinning.name.$("start")
g.state.colPinning.status.$("end")
g.state.colPinning.name.$(undefined)   // unpin
```

## The same operator as row pinning

`partition` in `src/4_slice.ts` takes an axis and a side lookup and answers three runs. Rows pass
through it inside `renderPlan`; columns pass through it on their own axis. `Side` is `start`,
`center`, `end` for both, so the vocabulary does not change when you change axis.

The renderer draws three run boxes and stamps each with `data-side`, and the per-run offsets are
accumulated by the property writer in `src/9_css.ts`.

## Seeding from the schema

`ColumnDef` carries a `pin` key, and `pinningFor` in `src/5_columns.ts` turns a schema into a
pinning record. The kernel does not call it, so a schema that declares `pin` seeds nothing until you
write the state yourself.

```ts
g.state.colPinning.$(pinningFor(COLUMNS))
```

## Interaction with column virtualization

Column virtualization is not wired, so every visible column is rendered whatever the horizontal
scroll position. Pinning therefore costs no extra work on the column axis today. The row-axis
equivalent is on [Virtualization](/view-virtualize).

## Under the transpose

Pinning follows the axis rather than the word. With `state.orientation` set to columns, the pinned
run is the one held against the scrolling edge, and the same three run boxes carry it. See
[List view and the transpose](/view-list).
