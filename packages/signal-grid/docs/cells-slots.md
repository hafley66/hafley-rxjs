# Slots

Replace what the renderer draws for a cell, a header, an expander, or a detail panel with a function
of your own.

<GridDemo id="cell-slots" />

## A slot is one function

It takes a ctx and returns anything renderable.

```ts
const slots: Slots<Row> = {
  cell: (it) => label(String(it.value ?? "")),
  header: (it) => bold(it.col),
}

grid<Row>({ ...config, slots })
```

## Which slot wins

Three rules, resolved in one line inside `src/10_render.ts`:

| situation | what renders |
| --- | --- |
| the cell is editing and an `editor` slot exists | the editor |
| the column declares `cell` | the per-column slot |
| otherwise | `Slots.cell`, and absent means the built-in text path |

Headers follow the same shape: `ColumnDef.headerCell` beats `Slots.header`, and `ColumnDef.header`
is the plain-text label rather than a slot.

```ts
const columns: readonly ColumnDef<Row>[] = [
  { id: "name", header: "Name" },
  { id: "size", cell: (it) => `${it.value} KB` },
]
```

## The three contexts

| ctx | fields | reaches |
| --- | --- | --- |
| `CellCtx` | `row`, `col`, `data`, `value`, `node`, `editing` | `cell`, `editor` |
| `HeaderCtx` | `col`, `node`, `sort`, `pinned` | `header` |
| `RowCtx` | `row`, `data`, `node`, `selected`, `open` | `expander`, `detail` |

All three are declared in `src/0_types.ts` as fixed shapes. A slot needing more closes over it,
because a slot is an ordinary function in your own scope.

## Which slots the renderer reads

`cell`, `editor`, `header`, `expander`, and `detail` reach `src/10_render.ts`. The rest of `Slots`
is declared and unread: `headerGroup`, `row`, `checkbox`, `resizeHandle`, `dragPreview`, `empty`,
`loading`, and `footer` render nothing today.

## Live content

A slot may return a signal instead of a node, which is how one cell updates without the grid minting
a signal per cell. That is [Slots that are signals](/cells-signal-slots).
