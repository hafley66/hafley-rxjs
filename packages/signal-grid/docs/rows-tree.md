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
| double-click a row body | toggle that node | `expandOnCellDoubleClick`, opt-in |
| click the expand header | open or close every branch | `toggleExpandAllOnHeaderClick`, opt-in |

A double click also sends two clicks first. On the glyph those two are the whole gesture and the
double click is skipped, because it arrives carrying `interactive`; on a row body only the double
click reaches an epic that opens anything. Beside `selectRowsOnCellClick` the gesture leaves the row
selected and open, since a plain click replaces the selection with the row it named and the second
click writes what the first already wrote.

## The expander glyph

Add `expandColumn()` from `src/5_columns.ts` to draw a disclosure with its own route, indented by
depth. A row with no children is stamped `data-leaf`, which is how a rule styles it without asking
the model.

## Expand all, and its three states

`expandColumn()` draws the same tri-state header the checkbox column draws, over the rows that have
children rather than the rows that can be selected. It reads the grid off `HeaderCtx`, so nothing is
threaded back into the schema.

| state | meaning | mark |
| --- | --- | --- |
| `none` | every branch is closed | `▶` |
| `some` | a part of them is open | `▽` |
| `all` | every branch is open | `▼` |

`expandableRows` in `src/5_columns.ts` reads the axis rather than the flat list, because a collapsed
parent hides the branches under it from that list and a toggle counting only what is visible would
call one open level "all". `expandAllState` derives the answer on every read, and `toggleExpandAll`
writes it, so nothing stores a flag that a newly arrived branch would make wrong.

```ts
const columns = [expandColumn<Row>(), ...DATA_COLUMNS]
```

`toggleExpandAllOnHeaderClick` is in `defaultEpics` beside `toggleSelectAllOnHeaderClick`, so the
header is a control without a config. Listing `epics` yourself is what drops it.

The rendering half and the toggle half are replaced independently, exactly as on the checkbox
column: `glyph` swaps the three marks, `header` replaces the drawing while `expandAllSignal` keeps
the state, and dropping the epic leaves the toggle to a consumer's own reader of `header.click`.

## Cyclic input

`axisOfEntries` in `src/1_axis.ts` is total on a cyclic parent map: a node standing on a cycle
becomes a root rather than an exception. Bad data therefore renders a strange grid instead of
throwing inside a derivation.

## Loading children on demand

Nothing in the kernel triggers a fetch. Subscribe to `g.intent$`, fetch, and write your own source
signal; the forest is re-derived from the array. The worked shape is on
[Intents, changes, effects](/reference-actions).
