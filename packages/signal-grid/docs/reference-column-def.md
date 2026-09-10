# ColumnDef

Declare one column: where its value comes from, how wide it is, what a reader may do to it, and what
renders inside it.

`ColumnDef<TRow, V>` is declared in `src/0_types.ts`.

```ts
const columns: readonly ColumnDef<Row>[] = [
  { id: "name", header: "Name", width: 160, sortable: true, editable: true },
  { id: "size", header: "Size", type: "number", flex: 1 },
  { id: "city", header: "City", field: "owner.address.city" },
  { id: "ratio", header: "Ratio", formula: (row, api) => Number(api.get(row, "size")) / 100 },
]
```

## Reading a value

| key | meaning |
| --- | --- |
| `id` | the column key, a DOM id and a state key, and the field name a column reads by default |
| `header` | the plain-text label |
| `field` | a dotted path into the row, checked against `TRow` |
| `value` | reads the raw value, unchecked; the escape hatch |
| `formula` | a derived value reading other fields through the api handed in |
| `type` | picks the default comparator and the default operator set |

### `field`, and why the id stays loose

`field` is typed `SignalPath<TRow>` from `@hafley66/signals`, which is the union of every dotted path
into the row down to five levels. `field: "owner.address.citty"` fails to compile; `id: "citty"` does
not, because an id is a DOM id and a state key rather than a claim about the row.

```ts
{ id: "city", field: "owner.address.city" }   // checked, no closure
{ id: "loud", value: (it) => it.name.toUpperCase() }  // unchecked, arbitrary
```

An array seat takes a numeric segment: `field: "tags.0"`. A path through an absent branch reads
`undefined` rather than throwing. `Date`, `Map`, `Set`, `RegExp`, `Promise`, and functions are leaves,
so `field: "modified.getTime"` is not offered.

A column carrying both `field` and `value` states two different reads, and `grid()` throws at
construction naming the column. `columnReader` in `src/0_types.ts` is the one place all three stages
(sort, group, cell render) resolve a column to its reader, and it compiles the path once per def.

`fieldValue(row, "owner.address.city")` is the same read as a standalone call, typed by
`SignalPathValue<TRow, Path>`, for a `value` callback or a slot that wants one nested value.

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
