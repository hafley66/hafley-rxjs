# Header groups

Nest columns under a shared heading by giving them a parent, the same way a tree row gets a parent.

<GridDemo id="header-groups" />

## The model

A header group is a band: an interior node of the column forest. Mint it with `headerGroup`, then
name it on each child through `ColumnDef.group`.

```ts
const columns: readonly ColumnDef<Row>[] = [
  headerGroup<Row>({ id: "meta", header: "Metadata" }),
  { id: "name", header: "Name", group: "meta" },
  { id: "size", header: "Size", group: "meta" },
]

g.view.cols.$().map((it) => [it.key, it.depth])
// [["meta", 0], ["name", 1], ["size", 1]]

g.view.colLeaves.$()
// ["name", "size"]
```

A band holds no seat on either axis. It takes no track, it renders no data cell in any row, and
`view.widths` reports nothing for it. What it owns is one label and a span.

| reads the band as | what it answers | where |
| --- | --- | --- |
| the run that renders cells | dropped, so a row is one cell per leaf | `src/8_grid.ts:602` |
| the track list | dropped, so the track count is the leaf count | `src/8_grid.ts:602` |
| the header | one row per level, each cell spanning its leaves | `src/18_bands.ts:125` |
| the seat that scrolls | dropped, so the transpose renders no band row | `src/8_grid.ts:546` |

## Why the marker

`axisOfEntries` in `src/1_axis.ts` gives a value to every node it places, so "the axis holds no
value for this key" is a test no node ever fails. A band therefore carries `band: true`, stamped by
`headerGroup` in `src/18_bands.ts`, and `isHeaderGroup` is the one predicate every stage asks.

One predicate serves both seatings. Under `state.orientation` set to columns the horizontal axis
holds rows, a row carries no marker, and a transposed tree of rows grows no header row. Nothing in
the band path branches on orientation.

A column another column names as its group and which carries no marker is rejected at construction,
beside the `field` and `value` check:

```ts
grid({ columns: [{ id: "meta" }, { id: "name", group: "meta" }], /* ... */ })
// Error: column "meta" is named as a header group and carries no band marker.
```

## How deep it nests

Any depth. `bandAncestors` filters the ancestor chain down to the bands, so the header's height is
the band depth of the schema and never the node depth of the axis.

```ts
const columns = [
  headerGroup<Row>({ id: "quarter", header: "Q3" }),
  headerGroup<Row>({ id: "money", header: "Money", group: "quarter" }),
  { id: "budget", group: "money" },
  { id: "spend", group: "money" },
  { id: "project" },
]
// 3 header rows: quarter over money over the two leaves, with project standing on the bottom row.
```

A leaf shallower than the deepest band keeps its own header on the bottom row and a filler sits
above it, so every leaf header lines up with every other one.

## What the header is made of

| class | what it is |
| --- | --- |
| `.sg-head-row` | one row per band level, carrying the same track list the body rows carry |
| `.sg-head-band` | a band's cell, with `grid-column: span N` over the leaves it covers |
| `.sg-head-filler` | the seat above a leaf no band covers |
| `.sg-head-cell` | every one of the three, so one rule sizes them all |

`--sg-head-rows` is written on the grid root by `src/10_render.ts` and read by the stylesheet for
the header's height and for the sticky offset of the pinned row run. The count is how many band
levels the schema declared, which no selector can spell for itself.

`Slots.headerGroup` labels a band. `ColumnDef.headerCell` on the band beats it, and `Slots.header`
stays the leaf slot, so a band and a column never contend for the same slot.

## What a band does not do

| asked of a band | answer |
| --- | --- |
| sort | nothing. A sort item names a field and a band reads no value off a row, so a band cell carries no route and a click on it raises no intent |
| pin | nothing of its own. The band is rebuilt per sticky run over the leaves that landed in it, so pinning a band is spelled by pinning its leaves |
| resize | nothing of its own. Drag a leaf edge and the band above it follows, because the band's box is the sum of its leaves' tracks |
| collapse | cut by decision. Folding is a second expansion state whose whole effect is dropping leaves from the run, the track list, `widths`, and the selection index at once, and `colHidden` already does that |

Collapsing is the one MUI X feature cut here rather than absent. A consumer that wants it writes the
hidden flags of a band's leaves from a click on the band, through the state key that already means
exactly that. Visibility is on [Visibility](/columns-visibility).

## Why nesting needs no second pass

Both competitors reach header nesting through a dedicated builder over a flat column list. Here the
column axis is already a forest, so the nesting is `flattenAxis` in `src/1_axis.ts` called with a
predicate that always answers open, which is the same call the row axis makes with the real
expansion predicate.

That is the argument, in full, for [Two ordered forests](/why-forests).
