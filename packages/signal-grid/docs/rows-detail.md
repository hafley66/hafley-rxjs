# Detail rows

Open a panel underneath a row and put anything in it, including a second grid over that row's own
data.

<GridDemo id="detail-nested-grid" />

## The slot

A detail panel is one slot returning a node. The ctx carries the row key and the row's data, so the
panel decides its own content.

```ts
const slots: Slots<Row> = {
  detail: (ctx) => {
    const host = document.createElement("div")
    render(grid<Line>({ id: `sub:${ctx.row}`, rows: ctx.data.lines, columns, rowId }), host)
    return host
  },
}
```

## Opening one

```ts
grid<Row>({ ...config, slots, epics: [...defaultEpics<Row>(), detailOnCellClick()] })
g.state.detail.$({ "r3": true })
```

`detailOnCellClick` in `src/11_detail.ts` is opt-in, so a plain grid reduces a cell click to an
`activate` effect and nothing else. Adding a `detailColumn()` from `src/5_columns.ts` gives the row
a disclosure to click.

The disclosure carries no text of its own. `10_render.ts` stamps `data-detail-open` on the row box
from `state.detail`, and `theme.css` turns the mark on that attribute, for the reason the checkbox
glyph is CSS too: a cell rebuilds when its data, its column run, or its editing flag moved, and a
panel opening moves none of the three, so a glyph carrying its own text would be a frame stale.

## Height

A panel is a row in the row index space, so it needs a height or the scroll drifts.

```ts
g.state.rowHeight.$(detailHeights(g.state.detail.$(), 320, g.state.rowHeight.$()))
```

`detailHeights` in `src/11_detail.ts` folds the open set into the height record, leaving every other
override alone.

## Why a panel is an axis node

`withDetail` in `src/11_detail.ts` inserts one node per open row directly after that row in its
sibling list. Three properties follow from that placement, with no special case anywhere downstream:

| property | consequence |
| --- | --- |
| a panel is a sibling | it is visible exactly when its row is, including inside a closed branch |
| a panel is windowed | virtualization and paging count it like any other row |
| the operator is idempotent | running it twice inserts one panel, so a re-derivation is safe |

The synthetic key is prefixed with NUL, because a real `RowId` is a user string that may itself
start with a letter pair the panel would otherwise collide with.

## Reading the panel row

The rendered element carries `data-detail="true"` and draws from the `detail` slot. Everything else
about it, including selection and pinning, behaves like a row.
