# List view and the transpose

Flip which axis scrolls, or collapse the other axis to one entry and get a list, both by writing one
state key.

No panel runs on this page. `slots.cell` is not called under a transposed orientation, so a
page-sized demo would mount a frame holding empty cells. The [Matrix](/showcase-matrix) route runs a
transposed grid full screen with the workaround it needs.

## The two keys

```ts
g.state.orientation.$("columns")   // the column axis scrolls, pages, and pins
g.state.listView.$(true)           // one cell per vertical entry
```

## What orientation changes

Past the kernel boundary there is a vertical seat and a horizontal seat, and no stage asks which one
holds a row.

```ts
g.view.vertical.$()     // the axis in the vertical seat
g.view.horizontal.$()   // the axis in the horizontal seat
```

`SEATS` in `src/12_transpose.ts` is a two-row table mapping an orientation to a seat pair, and
`transpose` in the same file is its own inverse, which is what a round trip rests on. A third
orientation would be a third row in that table and no other edit.

The full argument, including the grep that proves no branch on orientation exists, is on
[The seat table](/why-seats).

## List view is one notch further

`collapseToOneEntry` in `src/12_transpose.ts` keeps a single entry on the horizontal axis, so every
vertical entry renders as one cell. It is the same lever rather than a second rendering mode, which
is why selection, pinning, virtualization, and paging all keep working inside a list.

## What is not finished

| case | what happens today |
| --- | --- |
| constructed at `"columns"`, then rendered | the frame is built and every cell is empty |
| mounted, then the orientation is written | the header band moves and the plan stays on the previous axis |
| the same write with no renderer attached | the plan follows the write correctly |

A cell reads its value out of the row axis's own map, and under a transposed orientation the
vertical key is a column id, which owns no row value. The model half of the transpose is asserted in
`src/12_transpose.test.ts`; the rendered half is the open defect.

## Working around it

`demo/3_matrix.ts` rewrites the transposed header band after each pass and supplies its own cell
values, which is the shape to copy until the renderer crosses the seats itself.
