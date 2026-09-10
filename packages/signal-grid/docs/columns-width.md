# Resize and width

Set a column's width, let it share the leftover space, or let a reader drag its edge.

<GridDemo id="column-resize" />

## Declared width

```ts
const COLUMNS: readonly ColumnDef<Row>[] = [
  { id: "name", header: "Name", width: 220, minWidth: 80, maxWidth: 480, resizable: true },
  { id: "size", header: "Size", flex: 1 },
  { id: "kind", header: "Kind", flex: 2 },
]
```

| key | meaning |
| --- | --- |
| `width` | the starting size in pixels |
| `minWidth`, `maxWidth` | the clamp a drag and a flex share both obey |
| `flex` | a share of whatever space is left after the fixed columns |
| `resizable` | whether the handle is drawn at all |

## Flex, shown

<GridDemo id="flat-list" />

Two columns splitting the leftover width two to one is `flex: 2` beside `flex: 1`. The browser does
the division, covered below.

## The override

```ts
g.state.colWidth.name.$(300)
g.view.widths.$().get("name")
g.state.colWidth.name.$(undefined)   // back to the declared width
```

An override clears that column's flex, because a column cannot both claim a share of the leftover
and hold a fixed size.

## Dragging the edge

```ts
g.dispatch(headerDown("name", "resize", 0))
```

`resizeOnHeaderDrag` in `src/7_epics.ts` writes `colWidth` on every pointer move, clamped to the
column's min and max. One write repaints the header band and every row band, because both read the
same custom property.

## The browser owns distribution

`view.widths` reports declared widths rather than painted ones. `trackList` in `src/4_slice.ts`
emits one `grid-template-columns` value using `fr` and `minmax()`, and the layout engine distributes
from there.

The consequence is worth stating plainly: a flex column reports its declared value, and code that
needs the painted width measures the element. The reason that arithmetic is out of the reactive
chain, with the measurement behind it, is on [No layout algorithm](/why-no-solver).
