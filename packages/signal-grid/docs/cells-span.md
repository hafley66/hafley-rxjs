# Span

Let one cell cover its neighbours, and let the cells it covers render nothing.

No panel runs on this page, because no example in `examples/index.ts` covers spanning. The
[Matrix](/showcase-matrix) route mounts a spanning grid full screen.

## Declaring a span

```ts
const columns: readonly ColumnDef<Row>[] = [
  { id: "note", header: "Note", span: (row) => (row.wide ? { rows: 2, cols: 3 } : undefined) },
]
```

The callback answers in the reader's vocabulary, rows and columns. Absent, or a count of one, means
no span.

## What the kernel reads

`ColumnDef.span` is a source rather than the thing any stage consumes. The kernel crosses it into
neutral counts and keeps two derived members.

| member | type | meaning |
| --- | --- | --- |
| `view.spans` | a relation keyed by the cross | how far each spanning cell reaches, counted vertically and horizontally |
| `view.covered` | a set of cell ids | every cell a neighbour already occupies |

A covered cell renders nothing, so the space it would have taken is the space the spanning cell now
holds.

## Why neutral counts

A span written as rows and columns stops meaning the same thing the moment the grid transposes.
`neutralSpan` in `src/12_transpose.ts` converts the declaration into a vertical count and a
horizontal count, which survive the flip: a span of two vertical and three horizontal becomes three
vertical and two horizontal, and the covered set swaps with it.

`coveredBy` in `src/12_transpose.ts` computes the covered set from the relation, so both members are
derived from the same crossing rather than from two independent walks.

## What the renderer draws

A spanning cell is stamped `data-span="true"` and carries two custom properties holding the counts.
The stylesheet turns those into `grid-row: span` and `grid-column: span`, so the layout engine does
the covering and no arithmetic reaches the DOM.

## The transpose argument

Spanning is the sharpest case for the seat table, because it is the one place where a reader's
vocabulary and the kernel's have to disagree on purpose. The whole argument is on
[The seat table](/why-seats).
