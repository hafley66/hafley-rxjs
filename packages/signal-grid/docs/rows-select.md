# Select

Let a reader pick rows with a checkbox column, a shift-click range, or the keyboard, and read the
result out of one state key.

<GridDemo id="row-selection" />

## The state

`state.rowSelection` is a record keyed by row id. Reading it and writing it are the same call.

```ts
g.state.rowSelection.$()             // { r3: true, r7: true }
g.state.rowSelection.r3.$(true)
g.state.rowSelection.$({})           // clear
```

## The checkbox column

```ts
const columns = [checkboxColumn({ grid: () => g }), ...DATA_COLUMNS]
```

`checkboxColumn` in `src/5_columns.ts` draws a mark carrying its own event route, and its header is
a live signal reading the current selection. The glyph answers one of three states through
`selectAllState`, counting neither group headings nor detail panels.

| gesture | result | epic |
| --- | --- | --- |
| click a mark | toggle that row | `selectRowsOnCheckboxClick` in `src/7_epics.ts` |
| shift-click a mark | fill the range in view order | the same epic |
| click a row body | replace the selection with that row | `selectRowsOnCellClick`, opt-in |
| ctrl-click or command-click a row body | toggle that row | the same epic |
| Space or Enter | toggle the focused row and emit `activate` | `keyboardNav` in `src/7_epics.ts` |

Range filling reads view order rather than source order, so a shift-click after a sort selects what
the reader can see.

`selectRowsOnCellClick` is the door for a schema with no gutter column, and it is opt-in because a
cell holding a link or a button wants that click to reach the control. Both doors share one anchor
and one set of modifier rules inside `rowPicker`.

## The tri-state header

The header mark answers three states, derived on every read. A stored "all selected" flag goes
stale the moment a row arrives, so none is stored.

| state | meaning | mark |
| --- | --- | --- |
| `none` | nothing in the counted set is selected | `□` |
| `some` | a part of it is, which is the indeterminate case | `▣` |
| `all` | every counted row is | `☑` |

`selectableRows` in `src/5_columns.ts` is the counted set: the visible rows that are rows, counting
neither group headings nor detail panels, because neither is selectable and counting one would leave
the toggle stuck on `some`.

The two halves are replaced separately, each through the route that half already has here.

| replace | keep | how |
| --- | --- | --- |
| the three marks | the state machine and the toggle | `checkboxColumn({ glyph })` |
| the whole header rendering | the state machine and the toggle | `checkboxColumn({ header })`, reading `selectAllSignal` |
| the toggle | the rendering | drop `toggleSelectAllOnHeaderClick` and write an epic on `header.click` |

```ts
const state = selectAllSignal(() => g)

const columns = [
  checkboxColumn<Row>({
    grid: () => g,
    header: () => Signal(() => `${state.$()} selected`),
  }),
  ...DATA_COLUMNS,
]

grid<Row>({ ...config, columns, epics: [...defaultEpics<Row>(), toggleSelectAllOnHeaderClick<Row>()] })
```

`toggleSelectAll` reads the same `selectableRows` the glyph counts, so a replaced mark and a
replaced toggle cannot disagree about what "all" means. The expand column carries the same pair over
`expandAllState`, covered on [Tree data](/rows-tree).

## Single select

<GridDemo id="radio-select" />

`radioColumn` in `src/5_columns.ts` draws the same box on the same route with no select-all toggle
in the header. One row at a time is enforced by an epic reading `rowSelectionMode` off the schema,
so the constraint lives in the reducer rather than in the glyph.

## Cell ranges are a different key

`state.rowSelection` is whole rows. A block of cells is `state.selection`, covered on
[Range selection and focus](/cells-range).

## Reading a selection with the data

The state carries keys. Joining back to your data is a lookup you own, which keeps the grid from
holding a second copy of every selected row.

```ts
const chosen = Object.keys(g.state.rowSelection.$()).map((it) => byId.get(it))
```
