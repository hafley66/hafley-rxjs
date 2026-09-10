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
| Space or Enter | toggle the focused row and emit `activate` | `keyboardNav` in `src/7_epics.ts` |

Range filling reads view order rather than source order, so a shift-click after a sort selects what
the reader can see.

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
