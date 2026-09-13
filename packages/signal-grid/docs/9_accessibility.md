# Accessibility

The grid speaks the [WAI-ARIA grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/). Roles
sit on the elements that already carry the matching `data-route`, so the attribute set and the
event routes cannot drift apart. The chromium suite is gated on axe-core at WCAG 2 A and AA.

## Contents

- [Roles](#roles)
- [The roving tab stop](#the-roving-tab-stop)
- [The axe gate](#the-axe-gate)
- [Out of scope](#out-of-scope)

## Roles

| element | role | attributes |
| --- | --- | --- |
| root | `grid`, or `treegrid` when the row axis nests | `aria-rowcount` = header rows + every visible row, `aria-colcount` = visible columns, `aria-multiselectable` = `"true"` unless a radio column makes selection single |
| header row | `row` | `aria-rowindex`, 1-based over the header band |
| header cell | `columnheader` | `aria-colindex` in seat order, `aria-colspan` on a band cell, `aria-sort` when sorted |
| body row | `row` | `aria-rowindex` = flat index + 2, `aria-selected` when rows are selectable, `aria-expanded`, `aria-level` on a tree child |
| body cell | `gridcell` | `aria-colindex`, `aria-selected`, `aria-rowspan` / `aria-colspan` on a span anchor |
| group heading row | `row` | `aria-rowindex`, `aria-expanded` |
| group heading cell | `rowheader` | names the level the row stands over |
| check glyph | `checkbox` | `aria-checked` mirrors the row's selection |
| radio glyph | `radio` | `aria-checked` mirrors the row's selection |

Indices are absolute: under vertical virtualization `aria-rowcount` is the full row count and
`aria-rowindex` the row's position in it, so a windowed grid still reads as its whole size.
`aria-selected` on a row appears when rows can be selected at all, which is a `row`-mode selection
or a check or radio column in the schema. On cells it mirrors the range selection the way
`data-selected` does.

The transpose (list view, `view-list`) swaps the seats and carries none of these: the numbers
would name the wrong axis. A tree-shaped row axis promotes the root to `treegrid`, which is the
one context where `aria-expanded` on a row is well-formed.

## The roving tab stop

The grid is one tab stop. The root carries `tabindex="0"` until a cell holds `state.focus`; the
focused cell then carries `tabindex="0"` and `document.activeElement` moves to it, and every other
cell carries no `tabindex` attribute at all. When focus leaves the grid, the root takes the stop
back. DOM focus follows state focus only while the grid already holds it: a grid the pointer left
never pulls focus back. A `tabindex` you set on the grid box yourself is left alone.

## The axe gate

`src/20_aria.browser.test.ts` mounts four grids in turn (flat, tree with an open branch, grouped,
a spanned cell) and runs axe-core against the live document:

```
pnpm -F @hafley66/signal-grid test:browser
```

Each grid must report `violations: []` at WCAG 2 A and AA. A red run names the failing rule, its
help text, and the first offending node's HTML.

## Out of scope

- `aria-busy`: no loading state is published to the reader yet.
- Live regions: row updates are silent; nothing announces itself.
- A row header column: no column is promoted to `rowheader`, so a cell's row label is read from
  position alone.
