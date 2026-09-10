# Tree data

Render nested data as an expandable tree by naming the function that returns a row's children.
That one config key is the whole setup.

<GridDemo id="tree-expand" />

## The configuration

```ts
const g = grid<Row>({
  id: "files",
  rows: TREE,
  columns: COLUMNS,
  rowId: (it) => it.id,
  subRows: (it) => it.kids,
})
```

`subRows` present means tree mode, and `axisOfTree` in `src/1_axis.ts` builds the forest from the
nested payloads. Absent means every key is a root, which is the flat case running the same code.

## Expansion

```ts
g.state.expanded.src.$(true)
g.state.expanded.$({ src: true, "src/lib": true })
g.state.expanded.$({})
```

Reading the visible order is one call, and a closed node's subtree never appears in it.

```ts
g.view.flat.$().map((it) => [it.key, it.depth])
```

`flattenAxis` in `src/1_axis.ts` skips a closed node's whole subtree, so the rows under a closed
folder never reach the virtualizer's count and cost nothing to keep closed.

## Clicks and keys

| gesture | result | epic |
| --- | --- | --- |
| click the expander | toggle that node | `expandOnExpanderClick` in `src/7_epics.ts` |
| alt-click the expander | open or close the whole branch, through `descendantsOf` | the same epic |
| ArrowRight | open the focused node when it has closed children | `keyboardNav` in `src/7_epics.ts` |
| ArrowLeft | close the focused node, otherwise step to its parent | the same epic |

## The expander glyph

Add `expandColumn()` from `src/5_columns.ts` to draw a disclosure with its own route, indented by
depth. A row with no children is stamped `data-leaf`, which is how a rule styles it without asking
the model.

## Cyclic input

`axisOfEntries` in `src/1_axis.ts` is total on a cyclic parent map: a node standing on a cycle
becomes a root rather than an exception. Bad data therefore renders a strange grid instead of
throwing inside a derivation.

## Loading children on demand

Nothing in the kernel triggers a fetch. Subscribe to `g.intent$`, fetch, and write your own source
signal; the forest is re-derived from the array. The worked shape is on
[Intents, changes, effects](/reference-actions).
