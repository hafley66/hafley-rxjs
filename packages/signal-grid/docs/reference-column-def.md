# ColumnDef

Declare one column: where its value comes from, how wide it is, what a reader may do to it, and what
renders inside it.

`ColumnDef<TRow, V>` is declared in `src/0_types.ts`.

```ts
const columns: readonly ColumnDef<Row>[] = [
  { id: "name", header: "Name", width: 160, sortable: true, editable: true },
  { id: "size", header: "Size", type: "number", flex: 1 },
  { id: "ratio", header: "Ratio", formula: (row, api) => Number(api.get(row, "size")) / 100 },
]
```

## Reading a value

| key | meaning |
| --- | --- |
| `id` | the column key, and the default field name on the row |
| `header` | the plain-text label |
| `value` | reads the raw value; the default reads the field named by the id |
| `formula` | a derived value reading other fields through the api handed in |
| `type` | picks the default comparator and the default operator set |

## Sizing

| key | meaning |
| --- | --- |
| `width` | the starting size in pixels |
| `minWidth`, `maxWidth` | the clamp both a drag and a flex share obey |
| `flex` | a share of the leftover space, taken in proportion |

Covered with the state key that overrides them on [Resize and width](/columns-width).

## Capability flags

| flag | what it permits |
| --- | --- |
| `sortable` | a header click writes a sort key |
| `filterable` | declared; filtering is cut, so nothing reads it |
| `groupable` | the column may be named in `state.group` |
| `resizable` | the resize handle is drawn |
| `movable` | the move route is stamped on the header label |
| `editable` | the editor slot may mount in this column's cells |
| `pinnable` | the column may be pinned |

`movable` is read by `src/10_render.ts` through a local patch type and is absent from `ColumnDef`
today, so a schema that wants a grip stamps one from a header slot.

## Structure

| key | meaning |
| --- | --- |
| `group` | this column's parent key in the column forest, covered on [Header groups](/columns-header-groups) |
| `pin` | a default side, read by `pinningFor` in `src/5_columns.ts` and never by the kernel |
| `span` | a per-row span, covered on [Span](/cells-span) |

## Behaviour hooks

| key | meaning |
| --- | --- |
| `sortComparator` | replaces the comparator for this column |
| `filterOperators` | declared; nothing calls it |
| `cell` | the per-column body slot, beating the schema-wide one |
| `headerCell` | the per-column header slot, beating the schema-wide one |

## The six built-ins

`src/5_columns.ts` exports six factories returning an ordinary `ColumnDef` carrying a `builtIn` tag.

| factory | default id | what its cell holds |
| --- | --- | --- |
| `checkboxColumn` | `__check` | a mark on its own route, with a live select-all header |
| `radioColumn` | `__radio` | the same box and route, with no select-all toggle |
| `expandColumn` | `__expand` | the disclosure, indented by depth |
| `dragColumn` | `__drag` | the row move handle |
| `detailColumn` | `__detail` | a disclosure with no route of its own |
| `rowNumberColumn` | `__rowNumber` | the row's index within the run |

A built-in is never groupable, sortable, filterable, resizable, or editable, and its min and max are
pinned to its width. The four carrying a row-level route render a routeless cell, because a cell
contributes one more path segment and the resulting chain is one no template declares.
