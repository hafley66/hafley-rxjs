# Sticky layers

- [Two layers, one idea](#two-layers-one-idea)
- [Column header ribbon](#column-header-ribbon)
- [Nested group stack](#nested-group-stack)

## Two layers, one idea

A tall diagram scrolls; the headers that label its columns and groups should not. grapht pins two
kinds of header in screen space, both pure functions of the camera:

| layer | source | pins |
| --- | --- | --- |
| `layoutStickyRibbon` | `packages/grapht-model/src/5a_stickyRibbon.ts:34` | column headers in one horizontal row |
| `stackGroupHeaders` | `packages/grapht/src/2_graph/6_stackGroupHeaders.ts:34` | nested group headers in a vertical stack |

Neither mutates the graph or the camera. Each takes the camera and returns placements.

## Column header ribbon

`layoutStickyRibbon` places sequence actors as column headers in a screen-space row that survives
pan and zoom. A header follows its column until the column leaves the viewport sideways or shrinks
below `fullWidth`, then it condenses to a chip and clamps to the edge it left through.

| input | meaning |
| --- | --- |
| `camera` | pan and zoom, in the [frame](./frame) convention |
| `viewport` | the visible window, in screen space |
| `inset` | distance from the viewport edge to the row |
| `fullWidth` | below this a header renders as a `chip`, not `full` |
| `chipWidth` | the width a condensed header takes |
| `gap` | space between consecutive headers |

Each `RibbonPlacement` carries one `state` and one `detail`
(`packages/grapht-model/src/5a_stickyRibbon.ts:10`).

| state | when |
| --- | --- |
| `pinned` | the header sits at its natural position inside the row |
| `clamped-start` | the column left through the left edge; the chip hugs it |
| `clamped-end` | the column left through the right edge; the chip hugs it |
| `released` | the column is fully offscreen vertically, or the row ran out of room |

The transition rule is at `packages/grapht-model/src/5a_stickyRibbon.ts:56`: a header is
`clamped-start` when its natural left falls before the row start, `clamped-end` when it passes the
row end, and `pinned` otherwise. A header too wide to fit the remaining row is released
(`packages/grapht-model/src/5a_stickyRibbon.ts:58`), so a dense diagram drops the furthest headers instead of overlapping them.

## Nested group stack

`stackGroupHeaders` stacks group headers along the top, parent above child, and swaps which header
is stuck as you scroll through a group's band. The depth comes from the graph's own ancestry, not
from geometry.

The stack walks the header families in graph order, and each family computes a slot below its stuck
parent (`src/2_graph/6_stackGroupHeaders.ts:60`). Within a family, the header whose band currently contains the
slot is the active one.

| `HeaderPlacement.state` | when | declared at |
| --- | --- | --- |
| `stuck` | this header is the active one in its family, pinned at the slot | `src/2_graph/6_stackGroupHeaders.ts:86` |
| `natural` | the header sits where the graph places it | `src/2_graph/6_stackGroupHeaders.ts:87` |
| `released` | the header's band is above the slot, replaced by a deeper one | `src/2_graph/6_stackGroupHeaders.ts:87` |

A header whose parent is hidden is itself hidden (`src/2_graph/6_stackGroupHeaders.ts:79`), so collapsing a
group takes its whole stack with it. `HeaderPlacement` itself is declared at
`packages/grapht/src/2_graph/0_frame.ts:26`.
