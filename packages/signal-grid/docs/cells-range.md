# Range selection and focus

Drag a block of cells, extend it, and read back the keys inside it. Focus is the single cell the
keyboard is standing on.

<GridDemo id="cell-range" />

Range dragging also runs full screen on the [Everything table](/showcase-everything) route, beside
every other feature at once.

## Two different keys

| key | holds | covered by |
| --- | --- | --- |
| `state.rowSelection` | whole rows, keyed by row id | [Select](/rows-select) |
| `state.selection` | a range of cells, as blocks | this page |
| `state.focus` | one `CellId`, or nothing | this page |

## The range model

`src/15_selection.ts` holds the arithmetic as pure functions over a `GridSelection`.

| function | what it answers |
| --- | --- |
| `beginAt` | start a new block at an anchor |
| `extendTo` | move the live block's head |
| `commitBlock` | fold the live block into the committed list |
| `blocksOf` | every block, committed plus live |
| `rectOf` | the keys a block covers, as a vertical and a horizontal list |
| `isSelected` | whether one cell is in the range |
| `selectedKeys` | every cell id in the range |

`SelectionMode` is `cell`, `row`, or `column`, which is what makes a header drag select whole
columns and a gutter drag select whole rows through the same block arithmetic.

## The three drag epics

| epic in `src/7_epics.ts` | started by |
| --- | --- |
| `selectCellsOnDrag` | a press on a data cell |
| `selectRowsOnDrag` | a press on the gutter |
| `selectColumnsOnDrag` | a press on a header |

## A range over a group heading

A heading is one box across the row and owns no cell in any column, so a range never stamps one and
a drag cannot start on one. The block still spans it: the range is two addresses over the flat key
list, so the leaves above and below a heading stay in one rectangle.

`data-selected` on a row and `data-selected` on a cell are two different features. The row's is
`state.rowSelection`, the cell's is range membership, and `--sg-selected-bg` and `--sg-range-bg` are
the two blues that say so.

Every one of them gates on the primary button, so a right click inside a selected block raises a
menu intent and leaves the range exactly as the reader can still see it.

## What the renderer stamps

| attribute | on | meaning |
| --- | --- | --- |
| `data-selected` | a cell | it is inside the range |
| `data-edge` | a cell | which sides of the block it sits on, as a space-separated list |

Reading state as attributes rather than classes means a stylesheet rule and a test assertion match
the same thing.

## Focus

`state.focus` is written by `keyboardNav` in `src/7_epics.ts` and by a plain cell click. Arrow keys
step it through the flat list, clamped at both ends, and Space or Enter acts on the row it names.

Nothing paints a focus ring. `state.focus` has no renderer today, so a grid that needs a visible
caret draws it from a cell slot reading the key. The `focus` state key is recorded as declared and
not run in the parity ledger.

## Inline editing

`state.editing` is read by `src/10_render.ts` and written by no epic, so an editor slot mounts only
when your code writes the key. The form lifecycle stays with the consumer by decision.
