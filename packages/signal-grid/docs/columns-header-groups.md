# Header groups

Nest columns under a shared heading by giving them a parent, the same way a tree row gets a parent.

No demo runs on this page, because the header band that would draw the grouping is not built.

## The model

A header group is a parent edge in the column forest. Add the group as a column of its own, then
name it on each child.

```ts
const columns: readonly ColumnDef<Row>[] = [
  { id: "meta", header: "Metadata" },
  { id: "name", header: "Name", group: "meta" },
  { id: "size", header: "Size", group: "meta" },
]

g.view.cols.$().map((it) => [it.key, it.depth])
// [["meta", 0], ["name", 1], ["size", 1]]
```

`ColumnDef.group` is the parent lookup handed to `axisOfEntries` in `src/1_axis.ts`, so a group that
names a parent which does not exist becomes a root rather than an error.

## What is missing

`src/10_render.ts` drops group nodes before the header is built, so `view.cols` carries the node and
the rendered header shows one flat strip of leaves. The parity ledger records `col.group` as
declared and not run.

## Why nesting needs no second pass

Both competitors reach header nesting through a dedicated builder over a flat column list. Here the
column axis is already a forest, so the nesting is `flattenAxis` in `src/1_axis.ts` called with a
predicate that always answers open, which is the same call the row axis makes with the real
expansion predicate.

That is the argument, in full, for [Two ordered forests](/why-forests).

## What you can do today

Read the depth off `view.cols` and draw your own band above the grid, or fold the grouping into the
header text through a header slot. Slots are on [Slots](/cells-slots).
