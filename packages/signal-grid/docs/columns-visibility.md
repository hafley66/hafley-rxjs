# Visibility

Take a column out of the grid with one write, and put it back where it belongs rather than at the
end.

<GridDemo id="column-visibility" />

## The state

```ts
g.state.colHidden.size.$(true)
g.state.colHidden.size.$(false)
g.state.colHidden.$({ size: true, mtime: true })
```

Reading the result is the column stage of the view chain.

```ts
g.view.cols.$().map((it) => it.key)
```

## What hiding costs

A hidden column leaves before the column forest is built, so the renderer produces no header cell,
no body cells, and no track in the layout. It takes no pixels and no DOM, rather than being drawn
and then hidden by a rule.

## Unhiding returns it to its rank

Order is decided by `state.colOrder`, and hiding never touches that key. A column that comes back
lands in the position its rank names, which is the position it left from. Ordering is on
[Order](/columns-order).

## A visibility panel

Building a toggle list is reading the schema and writing one key per row.

```ts
for (const column of COLUMNS) {
  const box = checkbox(column.header)
  box.checked = g.state.colHidden[column.id].$() !== true
  box.onchange = () => g.state.colHidden[column.id].$(!box.checked)
}
```

No epic is involved, because there is no gesture the grid itself owns here. The state key is the
whole surface.

## Built-in columns hide like any other

A checkbox, radio, expander, drag, detail, or row-number column from `src/5_columns.ts` is an
ordinary `ColumnDef` carrying a `builtIn` tag, so it answers the same visibility, ordering, pinning,
and width keys as a data column.
