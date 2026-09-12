# Every export

The whole public surface of `@hafley66/signal-grid`, one section per module in the order the kernel runs. The pages above this one explain what to reach for; this one is the list.

Read out of the TypeScript program by `packages/docs-kit/scripts/api.mjs`: the barrel names what is public, each module answers for what it declares, and the checker answers for every signature. Editing this file by hand is editing the thing that overwrites it.

## Modules

| module | exports | what it is |
| --- | --- | --- |
| [src/0_log.ts](#src-0-log-ts) | 16 | LogTape is an optional peer, so nothing here may import it statically. |
| [src/0_types.ts](#src-0-types-ts) | 54 | The whole contract. |
| [src/1_axis.ts](#src-1-axis-ts) | 10 | The five pure operators over `Axis<K, T>`, plus the two constructors that mint one and the walks that read one. |
| [src/2_operators.ts](#src-2-operators-ts) | 15 | Value-level operators: filter predicates and comparators. |
| [src/3_paths.ts](#src-3-paths-ts) | 23 | One declaration per grid part yields four artifacts: element id, delegated route, CSS custom property namespace, test selector. |
| [src/4_slice.ts](#src-4-slice-ts) | 20 | From a flat key list to the rendered window. |
| [src/5_columns.ts](#src-5-columns-ts) | 30 | Two rules hold for every factory here, enforced in code: a built-in is never `groupable`, and it never carries `flex` (min and max are pinned to width, so the pool cannot reopen). |
| [src/6_gestures.ts](#src-6-gestures-ts) | 8 | Resize, column move, and row move are one gesture with three hit tests. |
| [src/7_epics.ts](#src-7-epics-ts) | 21 | Where an intent becomes a change or an effect. |
| [src/8_grid.ts](#src-8-grid-ts) | 10 | The constructor. |
| [src/9_css.ts](#src-9-css-ts) | 6 | Changing a grid track triggers one full layout, so the cost of a resize is how often the track list is written, not how it is built. |
| [src/10_render.ts](#src-10-render-ts) | 2 | Plain DOM. |
| [src/11_detail.ts](#src-11-detail-ts) | 15 | A detail row is a real node in the row axis, model (a). |
| [src/12_transpose.ts](#src-12-transpose-ts) | 22 | The one place the two-axis design stopped being two-axis. |
| [src/13_composite.ts](#src-13-composite-ts) | 9 | One cell, several source columns. |
| [src/14_measure.ts](#src-14-measure-ts) | 8 | Real geometry, for the entries whose extent no config can declare. |
| [src/15_selection.ts](#src-15-selection-ts) | 20 | A range is two addresses and a mode, never a set of cells, so a drag across a million-cell rectangle costs what a drag across nine costs. |
| [src/16_menu.ts](#src-16-menu-ts) | 5 | A context menu is UI every application wants to own: its own items, its own icons, its own keyboard model, its own copy. |
| [src/18_bands.ts](#src-18-bands-ts) | 10 | The header band: the rows above the leaves, each cell covering the leaves of one group. |

## src/0_log.ts

LogTape is an optional peer, so nothing here may import it statically.

| export | kind |
| --- | --- |
| [`LogFields`](#src-0-log-ts-logfields) | type |
| [`LogEmit`](#src-0-log-ts-logemit) | type |
| [`LOG`](#src-0-log-ts-log) | const |
| [`CAT_PLAN`](#src-0-log-ts-cat-plan) | const |
| [`CAT_FRAME`](#src-0-log-ts-cat-frame) | const |
| [`CAT_DOM`](#src-0-log-ts-cat-dom) | const |
| [`CAT_VARS`](#src-0-log-ts-cat-vars) | const |
| [`CAT_BASE`](#src-0-log-ts-cat-base) | const |
| [`CAT_SORT`](#src-0-log-ts-cat-sort) | const |
| [`CAT_GROUP`](#src-0-log-ts-cat-group) | const |
| [`CAT_FLATTEN`](#src-0-log-ts-cat-flatten) | const |
| [`CAT_INTENT`](#src-0-log-ts-cat-intent) | const |
| [`setGridLogEmit`](#src-0-log-ts-setgridlogemit) | function |
| [`isGridLogging`](#src-0-log-ts-isgridlogging) | function |
| [`enableGridLogTape`](#src-0-log-ts-enablegridlogtape) | function |
| [`disableGridLogging`](#src-0-log-ts-disablegridlogging) | function |

### `LogFields` {#src-0-log-ts-logfields}

`LogFields` is declared at `src/0_log.ts:6`.

```ts
export type LogFields = Record<string, unknown>
```

### `LogEmit` {#src-0-log-ts-logemit}

`LogEmit` is declared at `src/0_log.ts:9`.

```ts
export type LogEmit = (
  category: readonly string[],
  message: string,
  fields: LogFields,
) => void

export function setGridLogEmit(emit: LogEmit | null): void
```

### `LOG` {#src-0-log-ts-log}

`LOG` is declared at `src/0_log.ts:17`.

```ts
LOG: { on: boolean; emit: LogEmit; }
```

### `CAT_PLAN` {#src-0-log-ts-cat-plan}

`CAT_PLAN` is declared at `src/0_log.ts:20`.

```ts
CAT_PLAN: readonly ["signal-grid", "plan"]
```

### `CAT_FRAME` {#src-0-log-ts-cat-frame}

`CAT_FRAME` is declared at `src/0_log.ts:21`.

```ts
CAT_FRAME: readonly ["signal-grid", "frame"]
```

### `CAT_DOM` {#src-0-log-ts-cat-dom}

`CAT_DOM` is declared at `src/0_log.ts:22`.

```ts
CAT_DOM: readonly ["signal-grid", "dom"]
```

### `CAT_VARS` {#src-0-log-ts-cat-vars}

`CAT_VARS` is declared at `src/0_log.ts:26`.

```ts
CAT_VARS: readonly ["signal-grid", "vars"]
```

### `CAT_BASE` {#src-0-log-ts-cat-base}

`CAT_BASE` is declared at `src/0_log.ts:29`.

```ts
CAT_BASE: readonly ["signal-grid", "base"]
```

### `CAT_SORT` {#src-0-log-ts-cat-sort}

`CAT_SORT` is declared at `src/0_log.ts:30`.

```ts
CAT_SORT: readonly ["signal-grid", "sort"]
```

### `CAT_GROUP` {#src-0-log-ts-cat-group}

`CAT_GROUP` is declared at `src/0_log.ts:31`.

```ts
CAT_GROUP: readonly ["signal-grid", "group"]
```

### `CAT_FLATTEN` {#src-0-log-ts-cat-flatten}

`CAT_FLATTEN` is declared at `src/0_log.ts:32`.

```ts
CAT_FLATTEN: readonly ["signal-grid", "flatten"]
```

### `CAT_INTENT` {#src-0-log-ts-cat-intent}

`CAT_INTENT` is declared at `src/0_log.ts:33`.

```ts
CAT_INTENT: readonly ["signal-grid", "intent"]
```

### `setGridLogEmit` {#src-0-log-ts-setgridlogemit}

`setGridLogEmit` is declared at `src/0_log.ts:37`.

```ts
setGridLogEmit: (emit: LogEmit | null) => void
```

### `isGridLogging` {#src-0-log-ts-isgridlogging}

`isGridLogging` is declared at `src/0_log.ts:42`.

```ts
isGridLogging: () => boolean
```

### `enableGridLogTape` {#src-0-log-ts-enablegridlogtape}

`enableGridLogTape` is declared at `src/0_log.ts:47`.

```ts
enableGridLogTape: () => Promise<void>
```

### `disableGridLogging` {#src-0-log-ts-disablegridlogging}

`disableGridLogging` is declared at `src/0_log.ts:62`.

```ts
disableGridLogging: () => void
```

## src/0_types.ts

The whole contract.

| export | kind |
| --- | --- |
| [`RowId`](#src-0-types-ts-rowid) | type |
| [`ColId`](#src-0-types-ts-colid) | type |
| [`CellId`](#src-0-types-ts-cellid) | type |
| [`CELL_SEP`](#src-0-types-ts-cell-sep) | const |
| [`cellId`](#src-0-types-ts-cellid-2) | const |
| [`cellParts`](#src-0-types-ts-cellparts) | const |
| [`GROUP_PREFIX`](#src-0-types-ts-group-prefix) | const |
| [`isGroupKey`](#src-0-types-ts-isgroupkey) | const |
| [`GroupRow`](#src-0-types-ts-grouprow) | interface |
| [`isGroupRow`](#src-0-types-ts-isgrouprow) | const |
| [`Axis`](#src-0-types-ts-axis) | interface |
| [`FlatNode`](#src-0-types-ts-flatnode) | interface |
| [`IndexRange`](#src-0-types-ts-indexrange) | interface |
| [`Side`](#src-0-types-ts-side) | type |
| [`Partitioned`](#src-0-types-ts-partitioned) | interface |
| [`FilterMode`](#src-0-types-ts-filtermode) | type |
| [`LogicOperator`](#src-0-types-ts-logicoperator) | type |
| [`FilterItem`](#src-0-types-ts-filteritem) | type |
| [`FilterModel`](#src-0-types-ts-filtermodel) | type |
| [`FilterOperator`](#src-0-types-ts-filteroperator) | interface |
| [`SortDirection`](#src-0-types-ts-sortdirection) | type |
| [`SortItem`](#src-0-types-ts-sortitem) | interface |
| [`SortModel`](#src-0-types-ts-sortmodel) | type |
| [`Renderable`](#src-0-types-ts-renderable) | type |
| [`Slot`](#src-0-types-ts-slot) | type |
| [`SlotContent`](#src-0-types-ts-slotcontent) | type |
| [`CellCtx`](#src-0-types-ts-cellctx) | interface |
| [`HeaderCtx`](#src-0-types-ts-headerctx) | interface |
| [`RowCtx`](#src-0-types-ts-rowctx) | interface |
| [`GroupCtx`](#src-0-types-ts-groupctx) | interface |
| [`Slots`](#src-0-types-ts-slots) | interface |
| [`ColumnType`](#src-0-types-ts-columntype) | type |
| [`FormulaApi`](#src-0-types-ts-formulaapi) | interface |
| [`ColumnDef`](#src-0-types-ts-columndef) | interface |
| [`fieldValue`](#src-0-types-ts-fieldvalue) | const |
| [`columnReader`](#src-0-types-ts-columnreader) | function |
| [`PageMode`](#src-0-types-ts-pagemode) | type |
| [`Orientation`](#src-0-types-ts-orientation) | type |
| [`Page`](#src-0-types-ts-page) | type |
| [`PageRequest`](#src-0-types-ts-pagerequest) | type |
| [`DropSide`](#src-0-types-ts-dropside) | type |
| [`DragPreview`](#src-0-types-ts-dragpreview) | type |
| [`RangeSelection`](#src-0-types-ts-rangeselection) | type |
| [`GridState`](#src-0-types-ts-gridstate) | type |
| [`GridMode`](#src-0-types-ts-gridmode) | type |
| [`QueryDescriptor`](#src-0-types-ts-querydescriptor) | type |
| [`Viewport`](#src-0-types-ts-viewport) | type |
| [`Modifiers`](#src-0-types-ts-modifiers) | type |
| [`isPlainClick`](#src-0-types-ts-isplainclick) | const |
| [`GridIntent`](#src-0-types-ts-gridintent) | type |
| [`GridChange`](#src-0-types-ts-gridchange) | type |
| [`GridEffect`](#src-0-types-ts-grideffect) | type |
| [`GridAction`](#src-0-types-ts-gridaction) | type |
| [`GridPhase`](#src-0-types-ts-gridphase) | type |

### `RowId` {#src-0-types-ts-rowid}

`RowId` is declared at `src/0_types.ts:15`.

Stable across data refresh. Selection, expansion, sizing, and pinning are keyed by it.

```ts
export type RowId = string
```

### `ColId` {#src-0-types-ts-colid}

`ColId` is declared at `src/0_types.ts:17`.

Unique within one column schema.

```ts
export type ColId = string
```

### `CellId` {#src-0-types-ts-cellid}

`CellId` is declared at `src/0_types.ts:19`.

`row + NUL + col`. NUL because ids are user strings and may contain anything else.

```ts
export type CellId = string
```

### `CELL_SEP` {#src-0-types-ts-cell-sep}

`CELL_SEP` is declared at `src/0_types.ts:21`.

```ts
CELL_SEP: string
```

### `cellId` {#src-0-types-ts-cellid-2}

`cellId` is declared at `src/0_types.ts:22`.

```ts
cellId: (row: string, col: string) => string
```

### `cellParts` {#src-0-types-ts-cellparts}

`cellParts` is declared at `src/0_types.ts:23`.

```ts
cellParts: (id: string) => readonly [string, string]
```

### `GROUP_PREFIX` {#src-0-types-ts-group-prefix}

`GROUP_PREFIX` is declared at `src/0_types.ts:29`.

Synthesized group rows live in their own namespace so they can never collide with a RowId.

```ts
GROUP_PREFIX: "g:"
```

### `isGroupKey` {#src-0-types-ts-isgroupkey}

`isGroupKey` is declared at `src/0_types.ts:30`.

```ts
isGroupKey: (key: string) => boolean
```

### `GroupRow` {#src-0-types-ts-grouprow}

`GroupRow` is declared at `src/0_types.ts:34`.

The shape behind the one `as unknown as TRow` in `8_grid.ts`. `path` is the ancestry, outermost
level first, so a nested heading names itself without walking back up the axis.

```ts
export interface GroupRow {
  readonly [GROUP_PREFIX]: RowId
  readonly path: readonly unknown[]
}
```

### `isGroupRow` {#src-0-types-ts-isgrouprow}

`isGroupRow` is declared at `src/0_types.ts:41`.

Narrows the value rather than testing the key: one call at the row level answers for the row and
every cell under it, and it is the only reader that cast needs.

```ts
isGroupRow: (value: unknown) => value is GroupRow
```

### `Axis` {#src-0-types-ts-axis}

`Axis` is declared at `src/0_types.ts:57`.

An ordered forest of keyed items. `roots` and each `children` entry carry sibling order;
`parent` is the inverse edge, stored rather than derived so ancestor walks are O(depth).

A flat relation is the degenerate case: `children` empty, every key in `roots`.
Both grid axes use this. Column header groups are a column-axis forest; tree data and row
grouping are row-axis forests.

```ts
export interface Axis<K extends string, T> {
  readonly roots: readonly K[]
  readonly children: ReadonlyMap<K, readonly K[]>
  readonly parent: ReadonlyMap<K, K>
  readonly by: ReadonlyMap<K, T>
}
```

### `FlatNode` {#src-0-types-ts-flatnode}

`FlatNode` is declared at `src/0_types.ts:65`.

One node of the flattened, visible result. `index` is its position in the flat list.

```ts
export interface FlatNode<K extends string> {
  readonly key: K
  readonly depth: number
  readonly index: number
  readonly parent: K | null
  /** True when the node has children, open or not. Drives the expander glyph. */
  readonly hasChildren: boolean
}
```

### `IndexRange` {#src-0-types-ts-indexrange}

`IndexRange` is declared at `src/0_types.ts:75`.

Half-open `[start, end)` over a flat list. Pagination and virtualization both produce one.

```ts
export interface IndexRange {
  readonly start: number
  readonly end: number
}
```

### `Side` {#src-0-types-ts-side}

`Side` is declared at `src/0_types.ts:81`.

Pinning splits a flat list into three ordered runs rendered in three sticky containers.

```ts
export type Side = "start" | "center" | "end"
```

### `Partitioned` {#src-0-types-ts-partitioned}

`Partitioned` is declared at `src/0_types.ts:82`.

```ts
export interface Partitioned<K extends string> {
  readonly start: readonly K[]
  readonly center: readonly K[]
  readonly end: readonly K[]
}
```

### `FilterMode` {#src-0-types-ts-filtermode}

`FilterMode` is declared at `src/0_types.ts:95`.

How a predicate propagates through a forest.
`prune`      keep a node only when it and every ancestor match. What a flat grid wants.
`ancestors`  keep a node when it matches, plus every ancestor of a match, so a matching leaf
             stays reachable. MUI tree-data default.
`subtree`    keep a node when it matches, plus its whole subtree.

```ts
export type FilterMode = "prune" | "ancestors" | "subtree"
```

### `LogicOperator` {#src-0-types-ts-logicoperator}

`LogicOperator` is declared at `src/0_types.ts:99`.

```ts
export type LogicOperator = "and" | "or"
```

### `FilterItem` {#src-0-types-ts-filteritem}

`FilterItem` is declared at `src/0_types.ts:102`.

One row of the filter panel. `value` is undefined for unary operators (isEmpty, isNotEmpty).

```ts
export type FilterItem = {
  readonly id: string
  readonly field: ColId
  readonly operator: string
  readonly value?: unknown
}
```

### `FilterModel` {#src-0-types-ts-filtermodel}

`FilterModel` is declared at `src/0_types.ts:109`.

```ts
export type FilterModel = {
  readonly items: readonly FilterItem[]
  readonly logic: LogicOperator
  /** Quick filter: whitespace-split terms, each matched against every filterable column. */
  readonly quick: readonly string[]
  readonly quickLogic: LogicOperator
}
```

### `FilterOperator` {#src-0-types-ts-filteroperator}

`FilterOperator` is declared at `src/0_types.ts:121`.

Compiles one filter item into a value predicate, or returns null when the item is incomplete
(empty value on a binary operator), which means the item does not filter.

```ts
export interface FilterOperator<V = unknown> {
  readonly name: string
  /** Unary operators take no value and are never incomplete. */
  readonly unary?: boolean
  readonly build: (item: FilterItem) => ((value: V) => boolean) | null
}
```

### `SortDirection` {#src-0-types-ts-sortdirection}

`SortDirection` is declared at `src/0_types.ts:130`.

```ts
export type SortDirection = "asc" | "desc"
```

### `SortItem` {#src-0-types-ts-sortitem}

`SortItem` is declared at `src/0_types.ts:131`.

```ts
export interface SortItem {
  readonly field: ColId
  readonly sort: SortDirection
}
```

### `SortModel` {#src-0-types-ts-sortmodel}

`SortModel` is declared at `src/0_types.ts:135`.

```ts
export type SortModel = readonly SortItem[]
```

### `Renderable` {#src-0-types-ts-renderable}

`Renderable` is declared at `src/0_types.ts:143`.

Anything a slot may hand back. React elements match structurally through `$$typeof`, so this
package never imports React and a DOM-only consumer never pulls it in.

```ts
export type Renderable =
```

### `Slot` {#src-0-types-ts-slot}

`Slot` is declared at `src/0_types.ts:160`.

A slot returns a renderable, or a signal of one. Returning a signal is how a single cell gets
live content without the grid minting a signal per cell: the writer subscribes that one node,
and the row around it never re-renders.

There are no value/onChange pairs anywhere in this package. A signal is both halves already.

```ts
export type Slot<Ctx> = (ctx: Ctx) => SlotContent
```

### `SlotContent` {#src-0-types-ts-slotcontent}

`SlotContent` is declared at `src/0_types.ts:160`.

A slot may also hand back a teardown alongside its content or signal. The teardown runs when the
row or header that mounted the slot is torn down, which is how a detail slot stops a nested grid
it rendered once the panel closes. `10_render.ts` joins it into the same `Subscription` as the
content's own subscription, so the two teardown together.

```ts
export type Slot<Ctx> = (ctx: Ctx) => SlotContent
```

### `CellCtx` {#src-0-types-ts-cellctx}

`CellCtx` is declared at `src/0_types.ts:174`.

```ts
export interface CellCtx<TRow> {
  readonly row: RowId
  readonly col: ColId
  readonly data: TRow
  readonly value: unknown
  readonly node: FlatNode<RowId>
  readonly editing: boolean
}
```

### `HeaderCtx` {#src-0-types-ts-headerctx}

`HeaderCtx` is declared at `src/0_types.ts:189`.

The header band labels the horizontal run. Under `"rows"` that run is the column axis, so `col`
is a column id, `row` is null, and `data` is undefined. Under `"columns"` the run is the row
axis, so `col` carries the row id, `row` carries that same id, and `data` is the row itself. A
consumer labels either by reading `data` (the transpose) or by falling back to the column's own
`header` string, which is why `data` is optional rather than a second discriminated slot type.

```ts
export interface HeaderCtx<TRow = unknown> {
  readonly col: ColId
  readonly node: FlatNode<ColId>
  readonly sort: SortDirection | null
  readonly pinned: Side | undefined
  readonly row: RowId | null
  readonly data: TRow | undefined
  /** The grid the band belongs to. A tri-state header derives its three states from the relation
   * and the selection, and both of those live here rather than on the schema that named the seat. */
  readonly grid: Grid<TRow> | undefined
}
```

### `RowCtx` {#src-0-types-ts-rowctx}

`RowCtx` is declared at `src/0_types.ts:200`.

```ts
export interface RowCtx<TRow> {
  readonly row: RowId
  readonly data: TRow
  readonly node: FlatNode<RowId>
  readonly selected: boolean
  readonly open: boolean
}
```

### `GroupCtx` {#src-0-types-ts-groupctx}

`GroupCtx` is declared at `src/0_types.ts:210`.

What a group heading is about. Not generic in `TRow`: a heading stands for a level rather than
for a row, and `GroupRow` is the whole of what the axis put behind its key.

```ts
export interface GroupCtx {
  readonly row: RowId
  readonly data: GroupRow
  readonly node: FlatNode<RowId>
  readonly path: readonly unknown[]
  /** The last element of `path`, which is what this level grouped by. */
  readonly value: unknown
  /** The column the level read, and its `header` label. Undefined once `state.group` has moved on
   * from the path the axis was built with. */
  readonly field: ColId | undefined
  readonly header: string | undefined
  /** Data rows under the heading, its whole subtree, panels excluded. */
  readonly count: number
  /** True when more than one level is open, which is when naming the field earns its space. */
  readonly nested: boolean
  readonly open: boolean
  readonly selected: boolean
}
```

### `Slots` {#src-0-types-ts-slots}

`Slots` is declared at `src/0_types.ts:230`.

Every replaceable piece. Absent means the built-in is used.

```ts
export interface Slots<TRow> {
  readonly cell?: Slot<CellCtx<TRow>>
  readonly editor?: Slot<CellCtx<TRow>>
  readonly header?: Slot<HeaderCtx<TRow>>
  readonly headerGroup?: Slot<HeaderCtx<TRow>>
  readonly row?: Slot<RowCtx<TRow>>
  /** The heading a synthesized group row draws. Absent keeps the built-in field, value, and count. */
  readonly groupRow?: Slot<GroupCtx>
  readonly detail?: Slot<RowCtx<TRow>>
  readonly expander?: Slot<RowCtx<TRow>>
  readonly checkbox?: Slot<RowCtx<TRow>>
  readonly resizeHandle?: Slot<HeaderCtx<TRow>>
  readonly dragPreview?: Slot<HeaderCtx<TRow> | RowCtx<TRow>>
  readonly empty?: Slot<Record<string, never>>
  readonly loading?: Slot<Record<string, never>>
  readonly footer?: Slot<Record<string, never>>
}
```

### `ColumnType` {#src-0-types-ts-columntype}

`ColumnType` is declared at `src/0_types.ts:250`.

```ts
export type ColumnType =
```

### `FormulaApi` {#src-0-types-ts-formulaapi}

`FormulaApi` is declared at `src/0_types.ts:253`.

```ts
export interface FormulaApi<TRow> {
  readonly get: (row: TRow, field: ColId) => unknown
}
```

### `ColumnDef` {#src-0-types-ts-columndef}

`ColumnDef` is declared at `src/0_types.ts:257`.

```ts
export interface ColumnDef<TRow, V = unknown> {
  /** A DOM id and a state key, so it stays a loose string. `field` is the checked half. */
  readonly id: ColId
  readonly header?: string
  readonly type?: ColumnType
  /** A dotted path into the row, checked against `TRow`, so a typo in any segment fails to
   * compile. `"user.address.city"` reads three levels without a closure. */
  readonly field?: SignalPath<TRow>
  /** The escape hatch, deliberately unchecked. Carrying this and `field` is a config error. */
  readonly value?: (it: TRow) => V
  /** Derived column, MUI "formulas": reads other fields through the api. @feature-declared col.formula */
  readonly formula?: (row: TRow, api: FormulaApi<TRow>) => V
  readonly width?: number
  readonly minWidth?: number
  readonly maxWidth?: number
  /** Takes leftover width in proportion to this number. */
  readonly flex?: number
  readonly sortable?: boolean
  readonly filterable?: boolean
  readonly groupable?: boolean
  readonly resizable?: boolean
  /** Stamps the move route on the header label. Read by `asksToMove` in `10_render.ts`. */
  readonly movable?: boolean
  readonly editable?: boolean
  readonly pinnable?: boolean
  /** Header group membership: this column's parent key in the column axis. The parent it names must
   * be a band, minted by `headerGroup` in `18_bands.ts`. */
  readonly group?: ColId
  readonly sortComparator?: (a: V, b: V) => number
  readonly filterOperators?: readonly FilterOperator<V>[]
  /**
   * MUI colSpan/rowSpan. Absent or 1 means no span.
   *
   * A source for the span relation, never the thing the kernel reads. `GridView.spans` is keyed by
   * the cross and counted vertical/horizontal, so a span survives a transpose; this callback is
   * column-shaped and could not. Configs keep spelling rows and columns, and the crossing happens
   * once, in `12_transpose.ts`.
   * @feature-declared cell.span
   */
  readonly span?: (row: TRow, index: number) => { rows?: number; cols?: number } | undefined
  /** Where this column's cell points, rendered as a real `<a href>` by `10_render.ts`. A function
   * of the row, so `undefined` leaves that row plain. @feature-declared view.a11y */
  readonly href?: (it: TRow) => string | undefined
  /** Per-column body slot. Beats `Slots.cell`, which stays the schema-wide default. */
  readonly cell?: Slot<CellCtx<TRow>>
  /** Per-column header slot. `header` above is the plain-text label. */
  readonly headerCell?: Slot<HeaderCtx<TRow>>
  /** Default pin side, seeding `colPinning`. State still wins, so a drag can unpin it. */
  readonly pin?: Side
}
```

### `fieldValue` {#src-0-types-ts-fieldvalue}

`fieldValue` is declared at `src/0_types.ts:319`.

Reads one dotted path off a row, checked against `TRow` the same way `ColumnDef.field` is.

```ts
fieldValue: <TRow, Path extends SignalPath<TRow> & string>(row: TRow, field: Path) => SignalPathValue<TRow, Path>
```

### `columnReader` {#src-0-types-ts-columnreader}

`columnReader` is declared at `src/0_types.ts:349`.

What a column reads off a row: `value`, else `field`, else the id.

```ts
columnReader: <TRow>(col: ColumnDef<TRow, unknown> | undefined, colId: string) => (row: TRow) => unknown
```

### `PageMode` {#src-0-types-ts-pagemode}

`PageMode` is declared at `src/0_types.ts:374`.

Paging is one operator with three retention rules, rather than three features.

`all`       every loaded row is a candidate. No window from paging at all.
`pages`     one page at a time. `index` moves, earlier pages are dropped.
`infinite`  pages accumulate. `index` is the highest page fetched, and the window is
            `[0, (index + 1) * size)`. Scrolling near the end raises `index` by one.

Client mode applies the window itself. Server mode publishes it and expects `rows` to already
satisfy it, which is why `infinite` needs the caller to append rather than replace.

```ts
export type PageMode = "all" | "pages" | "infinite"
```

### `Orientation` {#src-0-types-ts-orientation}

`Orientation` is declared at `src/0_types.ts:381`.

Which axis feeds the vertical pipeline: the one that scrolls, pages, and pins into sticky runs.
`"columns"` is the transpose, the matrix layout whose first column holds what are normally
column headers. The seating chart that reads this lives in `12_transpose.ts` and nowhere else.

```ts
export type Orientation = "rows" | "columns"
```

### `Page` {#src-0-types-ts-page}

`Page` is declared at `src/0_types.ts:383`.

```ts
export type Page = {
  readonly mode: PageMode
  readonly index: number
  readonly size: number
  /** Server mode only: total rows behind the query, so the scrollbar can measure the whole result. */
  readonly total: number | null
}
```

### `PageRequest` {#src-0-types-ts-pagerequest}

`PageRequest` is declared at `src/0_types.ts:395`.

Emitted when an infinite page boundary is crossed. The caller fetches and appends; nothing in
the kernel waits on it, so a slow fetch never blocks scrolling through loaded rows.

```ts
export type PageRequest = {
  readonly index: number
  readonly size: number
}
```

### `DropSide` {#src-0-types-ts-dropside}

`DropSide` is declared at `src/0_types.ts:401`.

Which side of the entry a drop line sits on.

```ts
export type DropSide = "start" | "end"
```

### `DragPreview` {#src-0-types-ts-dragpreview}

`DragPreview` is declared at `src/0_types.ts:405`.

What a deferred gesture will land, published while the pointer is down and cleared on the lift.
The grid holds still and draws this instead of rewriting order or width once per pointermove.

```ts
export type DragPreview =
```

### `RangeSelection` {#src-0-types-ts-rangeselection}

`RangeSelection` is declared at `src/0_types.ts:411`.

```ts
export type RangeSelection = {
  readonly anchor: CellId | null
  readonly head: CellId | null
}
```

### `GridState` {#src-0-types-ts-gridstate}

`GridState` is declared at `src/0_types.ts:421`.

Declared as a type alias rather than an interface on purpose: `Signal<T>`'s recursive proxy
map gates on `T extends Record<string, unknown>`, and an interface has no implicit index
signature, so `state.sort.$()` would not typecheck against an interface.

```ts
export type GridState = {
  // row axis
  readonly sort: SortModel
  readonly group: readonly ColId[]
  readonly expanded: Readonly<Record<RowId, boolean>>
  /** @feature-declared row.select */
  readonly rowSelection: Readonly<Record<RowId, boolean>>
  /** @feature-declared row.pin */
  readonly rowPinning: Readonly<Record<RowId, Side>>
  /** Mirror of colWidth on the other axis. Absent entries fall back to the density default. */
  readonly rowHeight: Readonly<Record<RowId, number>>
  /** @feature-declared row.order */
  readonly rowOrder: readonly RowId[]
  /** Which cell opened each row's panel, so another cell swaps it instead of closing. @feature-declared row.detail */
  readonly detail: Readonly<Record<RowId, ColId | true>>
  readonly page: Page
  // column axis
  /** @feature-declared col.order */
  readonly colOrder: readonly ColId[]
  readonly colHidden: Readonly<Record<ColId, boolean>>
  /** @feature-declared col.resize */
  readonly colWidth: Readonly<Record<ColId, number>>
  /** @feature-declared col.pin */
  readonly colPinning: Readonly<Record<ColId, Side>>
  // cross
  /** The live drag plus the blocks earlier gestures committed. `RangeSelection` is its narrow half. */
  readonly selection: GridSelection
  /** The live gesture rather than a stored preference: written per pointermove by a deferred
   * resize or move, and cleared on the lift, so nothing downstream of it moves until then. */
  readonly drag: DragPreview | null
  /** @feature-declared cell.focus */
  readonly focus: CellId | null
  readonly editing: CellId | null
  // view
  readonly density: "compact" | "standard" | "comfortable"
  /**
   * The degenerate transpose: the horizontal axis keeps one entry, so a vertical entry is one cell.
   * @feature-declared view.list
   */
  readonly listView: boolean
  /** Rows down the page, or columns down it. Every stage below reads the seat, not the name. */
  readonly orientation: Orientation
  /** One window, two seats, keyed like `CellSpan`, because `orientation` decides which axis each
   * seat holds. Off renders every visible entry. @feature-declared view.virtualize.col */
  readonly virtualize: {
    readonly vertical: boolean
    readonly horizontal: boolean
  }
}
```

### `GridMode` {#src-0-types-ts-gridmode}

`GridMode` is declared at `src/0_types.ts:477`.

client: the kernel runs filter, sort, group, and pagination over every row it holds.
server: the kernel skips those stages, publishes a `QueryDescriptor` for the caller to send
upstream, and treats `rows` as the already-resolved page. Everything else, tree flattening,
pinning, virtualization, selection, is identical in both modes.

```ts
export type GridMode = "client" | "server"
```

### `QueryDescriptor` {#src-0-types-ts-querydescriptor}

`QueryDescriptor` is declared at `src/0_types.ts:481`.

```ts
export type QueryDescriptor = {
  readonly sort: SortModel
  readonly group: readonly ColId[]
  readonly page: Page
  /** Set only when a tree node is being expanded and its children are not loaded yet. */
  readonly expand: RowId | null
}
```

### `Viewport` {#src-0-types-ts-viewport}

`Viewport` is declared at `src/0_types.ts:489`.

```ts
export type Viewport = {
  readonly top: number
  readonly left: number
  readonly height: number
  readonly width: number
}
```

### `Modifiers` {#src-0-types-ts-modifiers}

`Modifiers` is declared at `src/0_types.ts:498`.

```ts
export type Modifiers = {
  readonly alt: boolean
  readonly ctrl: boolean
  readonly meta: boolean
  readonly shift: boolean
  readonly button: number
}
```

### `isPlainClick` {#src-0-types-ts-isplainclick}

`isPlainClick` is declared at `src/0_types.ts:508`.

A plain click: no chord, primary button. Declared beside `Modifiers`, because `3_paths.ts` and
`7_epics.ts` both ask it and a second copy is a second answer.

```ts
isPlainClick: (mods: Modifiers) => boolean
```

### `GridIntent` {#src-0-types-ts-gridintent}

`GridIntent` is declared at `src/0_types.ts:513`.

The DOM saw something. No state has moved. Every entry comes from an xdom path template.
`interactive` marks a click that landed on an anchor, a form control, or a routed glyph.

```ts
export type GridIntent =
```

### `GridChange` {#src-0-types-ts-gridchange}

`GridChange` is declared at `src/0_types.ts:532`.

One key of GridState was written. Reduced synchronously, never asynchronously.

```ts
export type GridChange = {
  [K in keyof GridState]: { phase: "change"; type: K } & { readonly [P in K]: GridState[P] }
}[keyof GridState]
```

### `GridEffect` {#src-0-types-ts-grideffect}

`GridEffect` is declared at `src/0_types.ts:537`.

Leaves the grid. The consumer decides what an activate or an edit commit means.

```ts
export type GridEffect<TRow> =
```

### `GridAction` {#src-0-types-ts-gridaction}

`GridAction` is declared at `src/0_types.ts:546`.

```ts
export type GridAction<TRow> = GridIntent | GridChange | GridEffect<TRow>
```

### `GridPhase` {#src-0-types-ts-gridphase}

`GridPhase` is declared at `src/0_types.ts:547`.

```ts
export type GridPhase = GridAction<never>["phase"]
```

## src/1_axis.ts

The five pure operators over `Axis<K, T>`, plus the two constructors that mint one and the walks that read one.

| export | kind |
| --- | --- |
| [`axisOfEntries`](#src-1-axis-ts-axisofentries) | function |
| [`axisOfTree`](#src-1-axis-ts-axisoftree) | function |
| [`ancestorsOf`](#src-1-axis-ts-ancestorsof) | function |
| [`filterAxis`](#src-1-axis-ts-filteraxis) | function |
| [`sortAxis`](#src-1-axis-ts-sortaxis) | function |
| [`groupAxis`](#src-1-axis-ts-groupaxis) | function |
| [`groupCounts`](#src-1-axis-ts-groupcounts) | function |
| [`flattenAxis`](#src-1-axis-ts-flattenaxis) | function |
| [`descendantsOf`](#src-1-axis-ts-descendantsof) | function |
| [`mapAxis`](#src-1-axis-ts-mapaxis) | function |

### `axisOfEntries` {#src-1-axis-ts-axisofentries}

`axisOfEntries` is declared at `src/1_axis.ts:50`.

Two passes because a parent may be declared after its child: the first fills `by` and the raw
edges, the second resolves them once every key is known.

A repeated key is an update, not a second row, so it replaces the value and keeps the seat it
already had. The parent is read from the latest value for the same reason.

```ts
axisOfEntries: <K extends string, T>(entries: Iterable<readonly [K, T]>, parentOf?: ((key: K, value: T) => K | undefined) | undefined) => Axis<K, T>
```

### `axisOfTree` {#src-1-axis-ts-axisoftree}

`axisOfTree` is declared at `src/1_axis.ts:90`.

Depth-first construction for nested source data, which is the shape `subRows` arrives in.

A key that has already been placed is an update: the value is replaced and the node is not
descended into again, which is what stops a payload whose children loop back.

```ts
axisOfTree: <K extends string, T>(items: readonly T[], keyOf: (item: T) => K, childrenOf: (item: T) => readonly T[] | undefined) => Axis<K, T>
```

### `ancestorsOf` {#src-1-axis-ts-ancestorsof}

`ancestorsOf` is declared at `src/1_axis.ts:149`.

Nearest first, so an indent guide or a breadcrumb reads the array straight off.

```ts
ancestorsOf: <K extends string, T>(axis: Axis<K, T>, key: K) => readonly K[]
```

### `filterAxis` {#src-1-axis-ts-filteraxis}

`filterAxis` is declared at `src/1_axis.ts:225`.

Applies `keep` through the forest under one of the three propagation rules of `FilterMode`.

```ts
filterAxis: <K extends string, T>(axis: Axis<K, T>, keep: (key: K, value: T) => boolean, mode: FilterMode) => Axis<K, T>
```

### `sortAxis` {#src-1-axis-ts-sortaxis}

`sortAxis` is declared at `src/1_axis.ts:245`.

Sorts `roots` and every `children` array. `parent` and `by` are shared by reference because sort
moves nothing between parents.

```ts
sortAxis: <K extends string, T>(axis: Axis<K, T>, cmp: ((a: T, b: T) => number) | null) => Axis<K, T>
```

### `groupAxis` {#src-1-axis-ts-groupaxis}

`groupAxis` is declared at `src/1_axis.ts:284`.

Rebuilds the group levels of an axis. The units are the data nodes standing at the top of the
forest once the previous pass's group nodes are lifted out, and each unit travels with its own
subtree, so grouping tree data does not tear a parent away from its children. Grouping is
therefore idempotent: regrouping an already grouped axis yields the same axis.

```ts
groupAxis: <K extends string, T>(axis: Axis<K, T>, keyOf: readonly ((value: T) => unknown)[], makeGroup: (path: readonly unknown[], key: K) => T) => Axis<K, T>
```

### `groupCounts` {#src-1-axis-ts-groupcounts}

`groupCounts` is declared at `src/1_axis.ts:350`.

Data rows under each group key, whole subtree. Walked upward from each row, so every node is
visited once and a non-group key never lands in the result.

```ts
groupCounts: <K extends string, T>(axis: Axis<K, T>) => ReadonlyMap<K, number>
```

### `flattenAxis` {#src-1-axis-ts-flattenaxis}

`flattenAxis` is declared at `src/1_axis.ts:376`.

Depth-first from the roots, skipping the subtree of a closed node. That skip is what keeps a
collapsed branch out of the virtualizer's row count entirely.

```ts
flattenAxis: <K extends string, T>(axis: Axis<K, T>, isOpen: (key: K) => boolean) => readonly FlatNode<K>[]
```

### `descendantsOf` {#src-1-axis-ts-descendantsof}

`descendantsOf` is declared at `src/1_axis.ts:426`.

Depth-first, excluding `key` itself. The visited set is what makes a cyclic axis terminate.

```ts
descendantsOf: <K extends string, T>(axis: Axis<K, T>, key: K) => readonly K[]
```

### `mapAxis` {#src-1-axis-ts-mapaxis}

`mapAxis` is declared at `src/1_axis.ts:445`.

Values change, structure does not, so the three structural maps are shared by reference.

```ts
mapAxis: <K extends string, T, U>(axis: Axis<K, T>, f: (value: T, key: K) => U) => Axis<K, U>
```

## src/2_operators.ts

Value-level operators: filter predicates and comparators.

| export | kind |
| --- | --- |
| [`stringOperators`](#src-2-operators-ts-stringoperators) | const |
| [`numberOperators`](#src-2-operators-ts-numberoperators) | const |
| [`booleanOperators`](#src-2-operators-ts-booleanoperators) | const |
| [`dateOperators`](#src-2-operators-ts-dateoperators) | const |
| [`dateTimeOperators`](#src-2-operators-ts-datetimeoperators) | const |
| [`singleSelectOperators`](#src-2-operators-ts-singleselectoperators) | const |
| [`operatorsFor`](#src-2-operators-ts-operatorsfor) | const |
| [`operatorByName`](#src-2-operators-ts-operatorbyname) | const |
| [`buildRowPredicate`](#src-2-operators-ts-buildrowpredicate) | const |
| [`compareString`](#src-2-operators-ts-comparestring) | const |
| [`compareNumber`](#src-2-operators-ts-comparenumber) | const |
| [`compareBoolean`](#src-2-operators-ts-compareboolean) | const |
| [`compareDate`](#src-2-operators-ts-comparedate) | const |
| [`comparatorFor`](#src-2-operators-ts-comparatorfor) | const |
| [`buildComparator`](#src-2-operators-ts-buildcomparator) | const |

### `stringOperators` {#src-2-operators-ts-stringoperators}

`stringOperators` is declared at `src/2_operators.ts:160`.

```ts
stringOperators: readonly FilterOperator<unknown>[]
```

### `numberOperators` {#src-2-operators-ts-numberoperators}

`numberOperators` is declared at `src/2_operators.ts:176`.

```ts
numberOperators: readonly FilterOperator<unknown>[]
```

### `booleanOperators` {#src-2-operators-ts-booleanoperators}

`booleanOperators` is declared at `src/2_operators.ts:191`.

```ts
booleanOperators: readonly FilterOperator<unknown>[]
```

### `dateOperators` {#src-2-operators-ts-dateoperators}

`dateOperators` is declared at `src/2_operators.ts:215`.

```ts
dateOperators: readonly FilterOperator<unknown>[]
```

### `dateTimeOperators` {#src-2-operators-ts-datetimeoperators}

`dateTimeOperators` is declared at `src/2_operators.ts:216`.

```ts
dateTimeOperators: readonly FilterOperator<unknown>[]
```

### `singleSelectOperators` {#src-2-operators-ts-singleselectoperators}

`singleSelectOperators` is declared at `src/2_operators.ts:218`.

```ts
singleSelectOperators: readonly FilterOperator<unknown>[]
```

### `operatorsFor` {#src-2-operators-ts-operatorsfor}

`operatorsFor` is declared at `src/2_operators.ts:242`.

"custom" and "actions" have no value semantics of their own, so they fall back to text matching.

```ts
operatorsFor: (type: ColumnType) => readonly FilterOperator<unknown>[]
```

### `operatorByName` {#src-2-operators-ts-operatorbyname}

`operatorByName` is declared at `src/2_operators.ts:259`.

```ts
operatorByName: (type: ColumnType, name: string) => FilterOperator<unknown> | undefined
```

### `buildRowPredicate` {#src-2-operators-ts-buildrowpredicate}

`buildRowPredicate` is declared at `src/2_operators.ts:283`.

```ts
buildRowPredicate: <TRow>(model: FilterModel, columns: readonly ColumnDef<TRow, unknown>[], getValue: (row: TRow, col: string) => unknown) => (row: TRow) => boolean
```

### `compareString` {#src-2-operators-ts-comparestring}

`compareString` is declared at `src/2_operators.ts:362`.

```ts
compareString: (a: unknown, b: unknown) => number
```

### `compareNumber` {#src-2-operators-ts-comparenumber}

`compareNumber` is declared at `src/2_operators.ts:368`.

```ts
compareNumber: (a: unknown, b: unknown) => number
```

### `compareBoolean` {#src-2-operators-ts-compareboolean}

`compareBoolean` is declared at `src/2_operators.ts:376`.

```ts
compareBoolean: (a: unknown, b: unknown) => number
```

### `compareDate` {#src-2-operators-ts-comparedate}

`compareDate` is declared at `src/2_operators.ts:382`.

```ts
compareDate: (a: unknown, b: unknown) => number
```

### `comparatorFor` {#src-2-operators-ts-comparatorfor}

`comparatorFor` is declared at `src/2_operators.ts:390`.

```ts
comparatorFor: (type: ColumnType) => (a: unknown, b: unknown) => number
```

### `buildComparator` {#src-2-operators-ts-buildcomparator}

`buildComparator` is declared at `src/2_operators.ts:405`.

```ts
buildComparator: <TRow>(model: SortModel, columns: readonly ColumnDef<TRow, unknown>[], getValue: (row: TRow, col: string) => unknown) => ((a: TRow, b: TRow) => number) | null
```

## src/3_paths.ts

One declaration per grid part yields four artifacts: element id, delegated route, CSS custom property namespace, test selector.

| export | kind |
| --- | --- |
| [`PartName`](#src-3-paths-ts-partname) | type |
| [`PATHS`](#src-3-paths-ts-paths) | const |
| [`TEMPLATES`](#src-3-paths-ts-templates) | const |
| [`GridBinding`](#src-3-paths-ts-gridbinding) | type |
| [`GridDom`](#src-3-paths-ts-griddom) | interface |
| [`gridDom`](#src-3-paths-ts-griddom-2) | function |
| [`gridAttrs`](#src-3-paths-ts-gridattrs) | const |
| [`viewportAttrs`](#src-3-paths-ts-viewportattrs) | const |
| [`headerAttrs`](#src-3-paths-ts-headerattrs) | const |
| [`resizeAttrs`](#src-3-paths-ts-resizeattrs) | const |
| [`moveAttrs`](#src-3-paths-ts-moveattrs) | const |
| [`rowAttrs`](#src-3-paths-ts-rowattrs) | const |
| [`expandAttrs`](#src-3-paths-ts-expandattrs) | const |
| [`checkAttrs`](#src-3-paths-ts-checkattrs) | const |
| [`cellAttrs`](#src-3-paths-ts-cellattrs) | const |
| [`selectorFor`](#src-3-paths-ts-selectorfor) | function |
| [`modifiersOf`](#src-3-paths-ts-modifiersof) | const |
| [`browserOwnsClick`](#src-3-paths-ts-browserownsclick) | const |
| [`intentOf`](#src-3-paths-ts-intentof) | const |
| [`encodeVarId`](#src-3-paths-ts-encodevarid) | const |
| [`decodeVarId`](#src-3-paths-ts-decodevarid) | const |
| [`rowHeightVar`](#src-3-paths-ts-rowheightvar) | const |
| [`SG_DEPTH`](#src-3-paths-ts-sg-depth) | const |

### `PartName` {#src-3-paths-ts-partname}

`PartName` is declared at `src/3_paths.ts:29`.

```ts
export type PartName = keyof typeof LOCAL
```

### `PATHS` {#src-3-paths-ts-paths}

`PATHS` is declared at `src/3_paths.ts:37`.

Frozen because a mutated route map is a silently mis-delegating grid.

```ts
PATHS: Readonly<{ grid: IPath<Simplify<{ gridId: string; }>, "/g/{gridId}", SlashPathSyntax>; viewport: IPath<Simplify<Simplify<{ gridId: string; }> & Simplify<{}>>, "/g/{gridId}/vp", SlashPathSyntax>; ... 8 more ...; cellExpander: IPath<...>; }>
```

### `TEMPLATES` {#src-3-paths-ts-templates}

`TEMPLATES` is declared at `src/3_paths.ts:54`.

The same set as raw text, because `Dom()` keys its cache by the template string.

```ts
TEMPLATES: Readonly<{ grid: "/g/{gridId}"; viewport: "/g/{gridId}/vp"; header: "/g/{gridId}/h/{colId}"; headerResize: "/g/{gridId}/h/{colId}/resize"; headerMove: "/g/{gridId}/h/{colId}/move"; row: "/g/{gridId}/r/{rowId}"; ... 4 more ...; cellExpander: "/g/{gridId}/r/{rowId}/c/{colId}/expand"; }>
```

### `GridBinding` {#src-3-paths-ts-gridbinding}

`GridBinding` is declared at `src/3_paths.ts:72`.

```ts
export type GridBinding<Template extends string> = DomTemplate<Template>
```

### `GridDom` {#src-3-paths-ts-griddom}

`GridDom` is declared at `src/3_paths.ts:76`.

```ts
export interface GridDom {
  readonly gridId: string
  readonly grid: GridBinding<typeof TEMPLATES.grid>
  readonly viewport: GridBinding<typeof TEMPLATES.viewport>
  readonly header: GridBinding<typeof TEMPLATES.header>
  readonly headerResize: GridBinding<typeof TEMPLATES.headerResize>
  readonly headerMove: GridBinding<typeof TEMPLATES.headerMove>
  readonly row: GridBinding<typeof TEMPLATES.row>
  readonly expander: GridBinding<typeof TEMPLATES.expander>
  readonly rowCheck: GridBinding<typeof TEMPLATES.rowCheck>
  readonly rowMove: GridBinding<typeof TEMPLATES.rowMove>
  readonly cell: GridBinding<typeof TEMPLATES.cell>
  readonly cellExpander: GridBinding<typeof TEMPLATES.cellExpander>
}

export function gridDom(gridId: string): GridDom
```

### `gridDom` {#src-3-paths-ts-griddom-2}

`gridDom` is declared at `src/3_paths.ts:93`.

```ts
gridDom: (gridId: string) => GridDom
```

### `gridAttrs` {#src-3-paths-ts-gridattrs}

`gridAttrs` is declared at `src/3_paths.ts:139`.

```ts
gridAttrs: (gridId: string) => Record<string, string>
```

### `viewportAttrs` {#src-3-paths-ts-viewportattrs}

`viewportAttrs` is declared at `src/3_paths.ts:146`.

```ts
viewportAttrs: () => Record<string, string>
```

### `headerAttrs` {#src-3-paths-ts-headerattrs}

`headerAttrs` is declared at `src/3_paths.ts:149`.

```ts
headerAttrs: (colId: string) => Record<string, string>
```

### `resizeAttrs` {#src-3-paths-ts-resizeattrs}

`resizeAttrs` is declared at `src/3_paths.ts:152`.

```ts
resizeAttrs: () => Record<string, string>
```

### `moveAttrs` {#src-3-paths-ts-moveattrs}

`moveAttrs` is declared at `src/3_paths.ts:156`.

Shared by the header and the row handle: the ancestor segment tells them apart.

```ts
moveAttrs: () => Record<string, string>
```

### `rowAttrs` {#src-3-paths-ts-rowattrs}

`rowAttrs` is declared at `src/3_paths.ts:159`.

```ts
rowAttrs: (rowId: string) => Record<string, string>
```

### `expandAttrs` {#src-3-paths-ts-expandattrs}

`expandAttrs` is declared at `src/3_paths.ts:162`.

```ts
expandAttrs: () => Record<string, string>
```

### `checkAttrs` {#src-3-paths-ts-checkattrs}

`checkAttrs` is declared at `src/3_paths.ts:165`.

```ts
checkAttrs: () => Record<string, string>
```

### `cellAttrs` {#src-3-paths-ts-cellattrs}

`cellAttrs` is declared at `src/3_paths.ts:168`.

```ts
cellAttrs: (colId: string) => Record<string, string>
```

### `selectorFor` {#src-3-paths-ts-selectorfor}

`selectorFor` is declared at `src/3_paths.ts:178`.

```ts
selectorFor: (part: "cell" | "cellExpander" | "expander" | "grid" | "header" | "headerMove" | "headerResize" | "row" | "rowCheck" | "rowMove" | "viewport", values?: Readonly<Record<string, string>>) => string
```

### `modifiersOf` {#src-3-paths-ts-modifiersof}

`modifiersOf` is declared at `src/3_paths.ts:200`.

```ts
modifiersOf: (event: KeyboardEvent | MouseEvent | PointerEvent) => Modifiers
```

### `browserOwnsClick` {#src-3-paths-ts-browserownsclick}

`browserOwnsClick` is declared at `src/3_paths.ts:238`.

A modified click on a link is the browser's: a new tab, a download, a saved target. The grid
raises nothing for it, and `8_grid.ts` is where that filter sits.

```ts
browserOwnsClick: (event: MouseEvent) => boolean
```

### `intentOf` {#src-3-paths-ts-intentof}

`intentOf` is declared at `src/3_paths.ts:247`.

```ts
intentOf: Readonly<{ "cell.click": (event: Delegated<Simplify<{ gridId: string; } & { rowId: string; } & { colId: string; }>, MouseEvent>) => { phase: "intent"; type: "cell.click"; row: string; col: string; mods: Modifiers; interactive: boolean; }; ... 14 more ...; "viewport.resize": (box: { ...; }) => { ...; }; }>
```

### `encodeVarId` {#src-3-paths-ts-encodevarid}

`encodeVarId` is declared at `src/3_paths.ts:404`.

```ts
encodeVarId: (id: string) => string
```

### `decodeVarId` {#src-3-paths-ts-decodevarid}

`decodeVarId` is declared at `src/3_paths.ts:419`.

The inverse, for reading an id back out of a stylesheet or a failing assertion.

```ts
decodeVarId: (encoded: string) => string
```

### `rowHeightVar` {#src-3-paths-ts-rowheightvar}

`rowHeightVar` is declared at `src/3_paths.ts:426`.

```ts
rowHeightVar: (rowId: string) => string
```

### `SG_DEPTH` {#src-3-paths-ts-sg-depth}

`SG_DEPTH` is declared at `src/3_paths.ts:429`.

Tree indent. Written once per row, read by every cell in it.

```ts
SG_DEPTH: "--sg-depth"
```

## src/4_slice.ts

From a flat key list to the rendered window.

| export | kind |
| --- | --- |
| [`partition`](#src-4-slice-ts-partition) | function |
| [`paginate`](#src-4-slice-ts-paginate) | function |
| [`Sizer`](#src-4-slice-ts-sizer) | interface |
| [`uniformSizer`](#src-4-slice-ts-uniformsizer) | function |
| [`measuredSizer`](#src-4-slice-ts-measuredsizer) | function |
| [`windowOf`](#src-4-slice-ts-windowof) | function |
| [`sliceKeys`](#src-4-slice-ts-slicekeys) | function |
| [`RenderPlanInput`](#src-4-slice-ts-renderplaninput) | interface |
| [`RenderPlan`](#src-4-slice-ts-renderplan) | interface |
| [`PlanBase`](#src-4-slice-ts-planbase) | interface |
| [`PlanBaseInput`](#src-4-slice-ts-planbaseinput) | type |
| [`PlanWindowInput`](#src-4-slice-ts-planwindowinput) | type |
| [`planBase`](#src-4-slice-ts-planbase-2) | function |
| [`planWindow`](#src-4-slice-ts-planwindow) | function |
| [`renderPlan`](#src-4-slice-ts-renderplan-2) | function |
| [`Spacers`](#src-4-slice-ts-spacers) | interface |
| [`NO_SPACERS`](#src-4-slice-ts-no-spacers) | const |
| [`spacersOf`](#src-4-slice-ts-spacersof) | function |
| [`TrackColumn`](#src-4-slice-ts-trackcolumn) | interface |
| [`trackList`](#src-4-slice-ts-tracklist) | function |

### `partition` {#src-4-slice-ts-partition}

`partition` is declared at `src/4_slice.ts:23`.

Splits `flat` into the three sticky runs. A key with no side is center.
One pass with one bucket per key, so a pinned key leaves center exactly once and the three runs
concatenate back to a permutation of the input.

```ts
partition: <K extends string>(flat: readonly K[], side: (key: K) => Side | undefined) => Partitioned<K>
```

### `paginate` {#src-4-slice-ts-paginate}

`paginate` is declared at `src/4_slice.ts:46`.

The page slice of the center run. Pinned keys never reach here, which is what keeps them on
every page.

```ts
paginate: <K extends string>(center: readonly K[], page: { index: number; size: number; }, enabled: boolean) => readonly K[]
```

### `Sizer` {#src-4-slice-ts-sizer}

`Sizer` is declared at `src/4_slice.ts:64`.

Row geometry over an index range. The only source of pixels in the kernel.

```ts
export interface Sizer {
  readonly count: number
  readonly total: number
  /** Pixels from the start of the list. `index === count` answers `total`, for a trailing spacer. */
  offsetOf(index: number): number
  sizeOf(index: number): number
  /** First index whose `[offset, offset + size)` contains `px`. Clamped, never throws. */
  indexAt(px: number): number
}

export function uniformSizer(count: number, size: number): Sizer
```

### `uniformSizer` {#src-4-slice-ts-uniformsizer}

`uniformSizer` is declared at `src/4_slice.ts:75`.

Every method O(1), no allocation past the returned object. The common case, so it stays cheap.

```ts
uniformSizer: (count: number, size: number) => Sizer
```

### `measuredSizer` {#src-4-slice-ts-measuredsizer}

`measuredSizer` is declared at `src/4_slice.ts:95`.

Variable row heights. Measurements arrive from an observer a batch at a time, so the cost lands
once at construction rather than on every read during a scroll.

```ts
measuredSizer: (count: number, estimate: number, measured: ReadonlyMap<number, number>) => Sizer
```

### `windowOf` {#src-4-slice-ts-windowof}

`windowOf` is declared at `src/4_slice.ts:146`.

The rendered index range for a viewport. Half-open `[start, end)`, clamped to `[0, count]`.
Overscan lives at this edge and nowhere deeper: it is a repaint budget, not part of the model.

```ts
windowOf: (sizer: Sizer, viewport: { start: number; extent: number; }, overscan: number) => IndexRange
```

### `sliceKeys` {#src-4-slice-ts-slicekeys}

`sliceKeys` is declared at `src/4_slice.ts:165`.

```ts
sliceKeys: <K extends string>(keys: readonly K[], span: IndexRange) => readonly K[]
```

### `RenderPlanInput` {#src-4-slice-ts-renderplaninput}

`RenderPlanInput` is declared at `src/4_slice.ts:174`.

```ts
export interface RenderPlanInput<K extends string> {
  readonly flat: readonly K[]
  readonly side: (key: K) => Side | undefined
  readonly page: { readonly index: number; readonly size: number }
  readonly paginate: boolean
  readonly virtualize: boolean
  /**
   * Built over the paginated center, so the scroll spacer measures the page and not the relation.
   * Takes the keys rather than a count: the page run's index space is not the flat list's once a
   * pinned key has been lifted out or the page index has moved, so a count leaves the callback
   * translating between two spaces it cannot see, and a per-key override lands on the wrong row.
   */
  readonly sizer: (keys: readonly K[]) => Sizer
  readonly viewport: { readonly start: number; readonly extent: number }
  readonly overscan?: number
}

export function renderPlan<K extends string>(input: RenderPlanInput<K>): RenderPlan<K>
```

### `RenderPlan` {#src-4-slice-ts-renderplan}

`RenderPlan` is declared at `src/4_slice.ts:191`.

```ts
export interface RenderPlan<K extends string> {
  readonly start: readonly K[]
  /** The windowed run. What actually renders. */
  readonly center: readonly K[]
  readonly end: readonly K[]
  readonly span: IndexRange
  /** Total pixels of the paginated center, for the scroll spacer. */
  readonly centerTotal: number
  /** Pixels above `span.start`, for the translate or the leading pad. */
  readonly offsetTop: number
  readonly pageCount: number
  /** The sizer this plan was windowed with, so a later plan can cancel a scroll shift against it. */
  readonly sizer: Sizer
}

export function renderPlan<K extends string>(input: RenderPlanInput<K>): RenderPlan<K>
```

### `PlanBase` {#src-4-slice-ts-planbase}

`PlanBase` is declared at `src/4_slice.ts:213`.

The half of a plan the scroll position does not reach. `partition` walks the whole relation
calling `side` on every key, `paginate` cuts it, and the sizer indexes what is left, so all
three cost the relation rather than the window. Held apart from `planWindow` so a consumer can
memoize it against the run and pay the walk when the run changes instead of when the scroll
moves: at 1,000,000 rows that walk was the whole of a 440 ms scroll frame.

```ts
export interface PlanBase<K extends string> {
  readonly start: readonly K[]
  readonly end: readonly K[]
  /** The center after the page cut. `planWindow` slices this. */
  readonly paged: readonly K[]
  readonly sizer: Sizer
  readonly pageCount: number
}

export function planBase<K extends string>(input: PlanBaseInput<K>): PlanBase<K>
```

### `PlanBaseInput` {#src-4-slice-ts-planbaseinput}

`PlanBaseInput` is declared at `src/4_slice.ts:222`.

```ts
export type PlanBaseInput<K extends string> = Pick<

export function planBase<K extends string>(input: PlanBaseInput<K>): PlanBase<K>
```

### `PlanWindowInput` {#src-4-slice-ts-planwindowinput}

`PlanWindowInput` is declared at `src/4_slice.ts:227`.

```ts
export type PlanWindowInput = Pick<RenderPlanInput<never>, "virtualize" | "viewport" | "overscan">
```

### `planBase` {#src-4-slice-ts-planbase-2}

`planBase` is declared at `src/4_slice.ts:230`.

partition -> paginate -> size. Costs the relation.

```ts
planBase: <K extends string>(input: PlanBaseInput<K>) => PlanBase<K>
```

### `planWindow` {#src-4-slice-ts-planwindow}

`planWindow` is declared at `src/4_slice.ts:246`.

virtualize. Costs the window.

```ts
planWindow: <K extends string>(base: PlanBase<K>, input: PlanWindowInput) => RenderPlan<K>
```

### `renderPlan` {#src-4-slice-ts-renderplan-2}

`renderPlan` is declared at `src/4_slice.ts:266`.

partition -> paginate -> virtualize, in that order, once.

```ts
renderPlan: <K extends string>(input: RenderPlanInput<K>) => RenderPlan<K>
```

### `Spacers` {#src-4-slice-ts-spacers}

`Spacers` is declared at `src/4_slice.ts:271`.

The pixels a window left out, before `span.start` and after `span.end`.

```ts
export interface Spacers {
  readonly lead: number
  readonly trail: number
  /** Whether the pair occupies two tracks. Read rather than restated, so no consumer disagrees
   * about how many seats the rendered run covers. */
  readonly tracked: boolean
}

export function spacersOf<K extends string>(plan: RenderPlan<K>): Spacers
```

### `NO_SPACERS` {#src-4-slice-ts-no-spacers}

`NO_SPACERS` is declared at `src/4_slice.ts:279`.

```ts
NO_SPACERS: Spacers
```

### `spacersOf` {#src-4-slice-ts-spacersof}

`spacersOf` is declared at `src/4_slice.ts:283`.

Read off the plan's own sizer, so a spacer can never describe a run other than the one that was
windowed.

```ts
spacersOf: <K extends string>(plan: RenderPlan<K>) => Spacers
```

### `TrackColumn` {#src-4-slice-ts-trackcolumn}

`TrackColumn` is declared at `src/4_slice.ts:293`.

One column's declared sizing. Nothing here is resolved: the browser owns the arithmetic.

```ts
export interface TrackColumn {
  readonly id: string
  readonly width?: number
  readonly minWidth?: number
  readonly maxWidth?: number
  readonly flex?: number
}

export function trackList(cols: readonly TrackColumn[]): string
```

### `trackList` {#src-4-slice-ts-tracklist}

`trackList` is declared at `src/4_slice.ts:305`.

One `grid-template-columns` value. `maxWidth` takes the upper slot even when `flex` is set,
because `minmax()` cannot hold both a flexible max and a cap.

```ts
trackList: (cols: readonly TrackColumn[]) => string
```

## src/5_columns.ts

Two rules hold for every factory here, enforced in code: a built-in is never `groupable`, and it never carries `flex` (min and max are pinned to width, so the pool cannot reopen).

| export | kind |
| --- | --- |
| [`BuiltInId`](#src-5-columns-ts-builtinid) | type |
| [`BUILT_IN_IDS`](#src-5-columns-ts-built-in-ids) | const |
| [`BuiltInColumnDef`](#src-5-columns-ts-builtincolumndef) | interface |
| [`isBuiltIn`](#src-5-columns-ts-isbuiltin) | const |
| [`dataColumns`](#src-5-columns-ts-datacolumns) | const |
| [`pinningFor`](#src-5-columns-ts-pinningfor) | function |
| [`rowSelectionMode`](#src-5-columns-ts-rowselectionmode) | const |
| [`TriState`](#src-5-columns-ts-tristate) | type |
| [`SelectAllState`](#src-5-columns-ts-selectallstate) | type |
| [`selectAllState`](#src-5-columns-ts-selectallstate-2) | function |
| [`toggleSelectAll`](#src-5-columns-ts-toggleselectall) | function |
| [`expandAllState`](#src-5-columns-ts-expandallstate) | function |
| [`toggleExpandAll`](#src-5-columns-ts-toggleexpandall) | function |
| [`selectableRows`](#src-5-columns-ts-selectablerows) | const |
| [`expandableRows`](#src-5-columns-ts-expandablerows) | const |
| [`SELECT_ALL_GLYPH`](#src-5-columns-ts-select-all-glyph) | const |
| [`EXPAND_ALL_GLYPH`](#src-5-columns-ts-expand-all-glyph) | const |
| [`selectAllSignal`](#src-5-columns-ts-selectallsignal) | const |
| [`expandAllSignal`](#src-5-columns-ts-expandallsignal) | const |
| [`triStateHeader`](#src-5-columns-ts-tristateheader) | const |
| [`BuiltInColumnOptions`](#src-5-columns-ts-builtincolumnoptions) | interface |
| [`TriStateColumnOptions`](#src-5-columns-ts-tristatecolumnoptions) | interface |
| [`SelectColumnOptions`](#src-5-columns-ts-selectcolumnoptions) | type |
| [`RowNumberColumnOptions`](#src-5-columns-ts-rownumbercolumnoptions) | interface |
| [`checkboxColumn`](#src-5-columns-ts-checkboxcolumn) | function |
| [`radioColumn`](#src-5-columns-ts-radiocolumn) | function |
| [`expandColumn`](#src-5-columns-ts-expandcolumn) | function |
| [`dragColumn`](#src-5-columns-ts-dragcolumn) | function |
| [`detailColumn`](#src-5-columns-ts-detailcolumn) | function |
| [`rowNumberColumn`](#src-5-columns-ts-rownumbercolumn) | function |

### `BuiltInId` {#src-5-columns-ts-builtinid}

`BuiltInId` is declared at `src/5_columns.ts:22`.

```ts
export type BuiltInId = "check" | "radio" | "expand" | "drag" | "detail" | "rowNumber"
```

### `BUILT_IN_IDS` {#src-5-columns-ts-built-in-ids}

`BUILT_IN_IDS` is declared at `src/5_columns.ts:25`.

Default ids, one namespace so a data column called `check` still keeps its own seat.

```ts
BUILT_IN_IDS: Readonly<Record<BuiltInId, string>>
```

### `BuiltInColumnDef` {#src-5-columns-ts-builtincolumndef}

`BuiltInColumnDef` is declared at `src/5_columns.ts:38`.

```ts
export interface BuiltInColumnDef<TRow> extends ColumnDef<TRow> {
  readonly builtIn: BuiltInId
  readonly cell: Slot<CellCtx<TRow>>
  readonly headerCell: Slot<HeaderCtx<TRow>>
}

export function checkboxColumn<TRow>(opts: TriStateColumnOptions<TRow> = {}): BuiltInColumnDef<TRow>
```

### `isBuiltIn` {#src-5-columns-ts-isbuiltin}

`isBuiltIn` is declared at `src/5_columns.ts:45`.

By the discriminator first, because `opts.id` may rename any of them.

```ts
isBuiltIn: <TRow>(col: ColumnDef<TRow, unknown>) => col is BuiltInColumnDef<TRow>
```

### `dataColumns` {#src-5-columns-ts-datacolumns}

`dataColumns` is declared at `src/5_columns.ts:49`.

What sorting, grouping, and the flex pool should be looking at.

```ts
dataColumns: <TRow>(columns: readonly ColumnDef<TRow, unknown>[]) => readonly ColumnDef<TRow, unknown>[]
```

### `pinningFor` {#src-5-columns-ts-pinningfor}

`pinningFor` is declared at `src/5_columns.ts:55`.

```ts
pinningFor: <TRow>(columns: readonly ColumnDef<TRow, unknown>[]) => Readonly<Record<string, Side>>
```

### `rowSelectionMode` {#src-5-columns-ts-rowselectionmode}

`rowSelectionMode` is declared at `src/5_columns.ts:69`.

```ts
rowSelectionMode: <TRow>(columns: readonly ColumnDef<TRow, unknown>[]) => "multi" | "single"
```

### `TriState` {#src-5-columns-ts-tristate}

`TriState` is declared at `src/5_columns.ts:89`.

```ts
export type TriState = "none" | "some" | "all"
```

### `SelectAllState` {#src-5-columns-ts-selectallstate}

`SelectAllState` is declared at `src/5_columns.ts:92`.

The name this had when only selection carried it. Docs and tests still name it.

```ts
export type SelectAllState = TriState
```

### `selectAllState` {#src-5-columns-ts-selectallstate-2}

`selectAllState` is declared at `src/5_columns.ts:95`.

An empty list is `none`: nothing is selected, and there is nothing to select.

```ts
selectAllState: (rows: readonly string[], selection: Readonly<Record<string, boolean>>) => TriState
```

### `toggleSelectAll` {#src-5-columns-ts-toggleselectall}

`toggleSelectAll` is declared at `src/5_columns.ts:106`.

All means clear, anything else means fill. A row outside `rows` keeps whatever flag it had.

```ts
toggleSelectAll: (rows: readonly string[], selection: Readonly<Record<string, boolean>>) => Readonly<Record<string, boolean>>
```

### `expandAllState` {#src-5-columns-ts-expandallstate}

`expandAllState` is declared at `src/5_columns.ts:117`.

The mirror over the rows that have children. A forest with no branch is `none`.

```ts
expandAllState: (rows: readonly string[], expanded: Readonly<Record<string, boolean>>) => TriState
```

### `toggleExpandAll` {#src-5-columns-ts-toggleexpandall}

`toggleExpandAll` is declared at `src/5_columns.ts:127`.

```ts
toggleExpandAll: (rows: readonly string[], expanded: Readonly<Record<string, boolean>>) => Readonly<Record<string, boolean>>
```

### `selectableRows` {#src-5-columns-ts-selectablerows}

`selectableRows` is declared at `src/5_columns.ts:139`.

What select-all is about: the visible rows that are rows. A group heading and a detail panel are
not selectable, so counting them would leave the toggle stuck on `some`.

```ts
selectableRows: (flat: readonly FlatNode<string>[]) => readonly string[]
```

### `expandableRows` {#src-5-columns-ts-expandablerows}

`expandableRows` is declared at `src/5_columns.ts:144`.

What expand-all is about: every row with children, open or closed. Read off the axis rather than
the flat list, because a collapsed parent hides the branches under it from that list.

```ts
expandableRows: <T>(axis: Axis<string, T>) => readonly string[]
```

### `SELECT_ALL_GLYPH` {#src-5-columns-ts-select-all-glyph}

`SELECT_ALL_GLYPH` is declared at `src/5_columns.ts:152`.

The three marks, as a table a consumer can replace one entry of. `some` is the indeterminate
state: a box with its centre filled, rather than the checked box it used to draw.

```ts
SELECT_ALL_GLYPH: Readonly<Record<TriState, string>>
```

### `EXPAND_ALL_GLYPH` {#src-5-columns-ts-expand-all-glyph}

`EXPAND_ALL_GLYPH` is declared at `src/5_columns.ts:159`.

The same three states on the other axis, drawn with the expander's own triangles.

```ts
EXPAND_ALL_GLYPH: Readonly<Record<TriState, string>>
```

### `selectAllSignal` {#src-5-columns-ts-selectallsignal}

`selectAllSignal` is declared at `src/5_columns.ts:166`.

Derived on every read, so a row arriving or a filter moving is already counted.

```ts
selectAllSignal: <TRow>(read: () => Grid<TRow> | undefined) => { $: Signal$<TriState, object>; }
```

### `expandAllSignal` {#src-5-columns-ts-expandallsignal}

`expandAllSignal` is declared at `src/5_columns.ts:173`.

```ts
expandAllSignal: <TRow>(read: () => Grid<TRow> | undefined) => { $: Signal$<TriState, object>; }
```

### `triStateHeader` {#src-5-columns-ts-tristateheader}

`triStateHeader` is declared at `src/5_columns.ts:182`.

The rendering half alone: a state signal in, a header slot out. A consumer keeping the state
machine and replacing the drawing calls this with their own table, or writes their own slot.

```ts
triStateHeader: <TRow>(state: { $: Signal$<TriState, object>; }, glyph: Readonly<Record<TriState, string>>) => Slot<HeaderCtx<TRow>>
```

### `BuiltInColumnOptions` {#src-5-columns-ts-builtincolumnoptions}

`BuiltInColumnOptions` is declared at `src/5_columns.ts:189`.

```ts
export interface BuiltInColumnOptions<TRow> {
  readonly id?: ColId
  readonly width?: number
  /** Default pin side. Read by `pinningFor`, never by the kernel. */
  readonly pin?: Side
  readonly header?: Slot<HeaderCtx<TRow>>
  readonly cell?: Slot<CellCtx<TRow>>
}

export function radioColumn<TRow>(opts: BuiltInColumnOptions<TRow> = {}): BuiltInColumnDef<TRow>
```

### `TriStateColumnOptions` {#src-5-columns-ts-tristatecolumnoptions}

`TriStateColumnOptions` is declared at `src/5_columns.ts:198`.

```ts
export interface TriStateColumnOptions<TRow> extends BuiltInColumnOptions<TRow> {
  // Deferred because a schema is built before `grid()` is called and the tri-state header is the one
  // slot that reads the grid back: `() => g` closes over the binding rather than the value.
  readonly grid?: () => Grid<TRow> | undefined
  /** The three marks. Swapping them keeps the state machine and the toggle untouched. */
  readonly glyph?: Readonly<Record<TriState, string>>
}

export function checkboxColumn<TRow>(opts: TriStateColumnOptions<TRow> = {}): BuiltInColumnDef<TRow>
```

### `SelectColumnOptions` {#src-5-columns-ts-selectcolumnoptions}

`SelectColumnOptions` is declared at `src/5_columns.ts:207`.

The name the selection column's options had before the expand column grew the same pair.

```ts
export type SelectColumnOptions<TRow> = TriStateColumnOptions<TRow>
```

### `RowNumberColumnOptions` {#src-5-columns-ts-rownumbercolumnoptions}

`RowNumberColumnOptions` is declared at `src/5_columns.ts:209`.

```ts
export interface RowNumberColumnOptions<TRow> extends BuiltInColumnOptions<TRow> {
  /** The ordinal of the first row. One, because a grid is read by people. */
  readonly start?: number
  // Added to `FlatNode.index`. Client mode holds every row, so the flat index is already absolute;
  // server mode holds one page, so the offset is that page's origin.
  readonly offset?: () => number
  readonly grid?: () => Grid<TRow> | undefined
}
```

### `checkboxColumn` {#src-5-columns-ts-checkboxcolumn}

`checkboxColumn` is declared at `src/5_columns.ts:290`.

Multi-select. The header is a signal, so a selection click repaints one node.

```ts
checkboxColumn: <TRow>(opts?: TriStateColumnOptions<TRow>) => BuiltInColumnDef<TRow>
```

### `radioColumn` {#src-5-columns-ts-radiocolumn}

`radioColumn` is declared at `src/5_columns.ts:296`.

Single select, same box and route as the checkbox column.

```ts
radioColumn: <TRow>(opts?: BuiltInColumnOptions<TRow>) => BuiltInColumnDef<TRow>
```

### `expandColumn` {#src-5-columns-ts-expandcolumn}

`expandColumn` is declared at `src/5_columns.ts:313`.

The expander as a column, so a caller can place or pin it.

```ts
expandColumn: <TRow>(opts?: TriStateColumnOptions<TRow>) => BuiltInColumnDef<TRow>
```

### `dragColumn` {#src-5-columns-ts-dragcolumn}

`dragColumn` is declared at `src/5_columns.ts:330`.

`moveAttrs()` is shared with the header handle; the ancestor chain tells them apart.

```ts
dragColumn: <TRow>(opts?: BuiltInColumnOptions<TRow>) => BuiltInColumnDef<TRow>
```

### `detailColumn` {#src-5-columns-ts-detailcolumn}

`detailColumn` is declared at `src/5_columns.ts:346`.

The disclosure that opens the detail area for its row.

```ts
detailColumn: <TRow>(opts?: BuiltInColumnOptions<TRow>) => BuiltInColumnDef<TRow>
```

### `rowNumberColumn` {#src-5-columns-ts-rownumbercolumn}

`rowNumberColumn` is declared at `src/5_columns.ts:358`.

The row's ordinal.

```ts
rowNumberColumn: <TRow>(opts?: RowNumberColumnOptions<TRow>) => BuiltInColumnDef<TRow>
```

## src/6_gestures.ts

Resize, column move, and row move are one gesture with three hit tests.

| export | kind |
| --- | --- |
| [`DragStreams`](#src-6-gestures-ts-dragstreams) | interface |
| [`DragDown`](#src-6-gestures-ts-dragdown) | type |
| [`DragSpec`](#src-6-gestures-ts-dragspec) | interface |
| [`WINDOW_DRAG`](#src-6-gestures-ts-window-drag) | const |
| [`setDragStreams`](#src-6-gestures-ts-setdragstreams) | function |
| [`LIVE_DRAG`](#src-6-gestures-ts-live-drag) | const |
| [`drag`](#src-6-gestures-ts-drag) | function |
| [`landingIndex`](#src-6-gestures-ts-landingindex) | function |

### `DragStreams` {#src-6-gestures-ts-dragstreams}

`DragStreams` is declared at `src/6_gestures.ts:7`.

The two streams a drag listens to between down and up. Separate so a test can feed Subjects.

```ts
export interface DragStreams {
  readonly move$: Observable<PointerEvent>
  readonly up$: Observable<PointerEvent>
}

export function setDragStreams(next: DragStreams): () => void
```

### `DragDown` {#src-6-gestures-ts-dragdown}

`DragDown` is declared at `src/6_gestures.ts:13`.

What a delegated pointerdown carries: the event plus the route params of the element hit.

```ts
export type DragDown = PointerEvent & { readonly params: Record<string, string> }

export function drag<S, A, D = DragDown>(
```

### `DragSpec` {#src-6-gestures-ts-dragspec}

`DragSpec` is declared at `src/6_gestures.ts:17`.

```ts
export interface DragSpec<S, A, D = DragDown> {
  /** Null rejects the gesture, so a hit test that misses costs one call and no subscription. */
  readonly from: (down: D) => S | null
  readonly move: (start: S, e: PointerEvent) => A | null
  /** Absent means the last move already said everything, which holds for a preview-only drag. */
  readonly commit?: (start: S, e: PointerEvent) => A | null
}
```

### `WINDOW_DRAG` {#src-6-gestures-ts-window-drag}

`WINDOW_DRAG` is declared at `src/6_gestures.ts:27`.

```ts
WINDOW_DRAG: DragStreams
```

### `setDragStreams` {#src-6-gestures-ts-setdragstreams}

`setDragStreams` is declared at `src/6_gestures.ts:42`.

`grid()` builds its own epics, so nothing can pass Subjects in from outside. This is that seam.

```ts
setDragStreams: (next: DragStreams) => () => void
```

### `LIVE_DRAG` {#src-6-gestures-ts-live-drag}

`LIVE_DRAG` is declared at `src/6_gestures.ts:51`.

Reads `active` per subscription, so a swap made after an epic was built still takes effect.

```ts
LIVE_DRAG: DragStreams
```

### `drag` {#src-6-gestures-ts-drag}

`drag` is declared at `src/6_gestures.ts:58`.

```ts
drag: <S, A, D = DragDown>(down$: Observable<D>, spec: DragSpec<S, A, D>, streams?: DragStreams) => Observable<A>
```

### `landingIndex` {#src-6-gestures-ts-landingindex}

`landingIndex` is declared at `src/6_gestures.ts:84`.

```ts
landingIndex: (order: readonly string[], from: number, delta: number, sizeOf: (key: string) => number) => number
```

## src/7_epics.ts

Where an intent becomes a change or an effect.

| export | kind |
| --- | --- |
| [`GridEpicCtx`](#src-7-epics-ts-gridepicctx) | interface |
| [`GridEpic`](#src-7-epics-ts-gridepic) | type |
| [`DragMode`](#src-7-epics-ts-dragmode) | type |
| [`DEFAULT_DRAG_MODE`](#src-7-epics-ts-default-drag-mode) | const |
| [`sortOnHeaderClick`](#src-7-epics-ts-sortonheaderclick) | function |
| [`expandOnExpanderClick`](#src-7-epics-ts-expandonexpanderclick) | function |
| [`expandOnCellDoubleClick`](#src-7-epics-ts-expandoncelldoubleclick) | function |
| [`selectRowsOnCheckboxClick`](#src-7-epics-ts-selectrowsoncheckboxclick) | function |
| [`selectRowsOnCellClick`](#src-7-epics-ts-selectrowsoncellclick) | function |
| [`toggleSelectAllOnHeaderClick`](#src-7-epics-ts-toggleselectallonheaderclick) | function |
| [`toggleExpandAllOnHeaderClick`](#src-7-epics-ts-toggleexpandallonheaderclick) | function |
| [`activateOnCellClick`](#src-7-epics-ts-activateoncellclick) | function |
| [`resizeOnHeaderDrag`](#src-7-epics-ts-resizeonheaderdrag) | function |
| [`moveColumnOnHeaderDrag`](#src-7-epics-ts-movecolumnonheaderdrag) | function |
| [`moveRowOnRowDrag`](#src-7-epics-ts-moverowonrowdrag) | function |
| [`keyboardNav`](#src-7-epics-ts-keyboardnav) | function |
| [`pageOnScrollNearEnd`](#src-7-epics-ts-pageonscrollnearend) | function |
| [`selectCellsOnDrag`](#src-7-epics-ts-selectcellsondrag) | function |
| [`selectRowsOnDrag`](#src-7-epics-ts-selectrowsondrag) | function |
| [`selectColumnsOnDrag`](#src-7-epics-ts-selectcolumnsondrag) | function |
| [`defaultEpics`](#src-7-epics-ts-defaultepics) | function |

### `GridEpicCtx` {#src-7-epics-ts-gridepicctx}

`GridEpicCtx` is declared at `src/7_epics.ts:49`.

What an epic is allowed to read besides state: the derived view and the schema behind it.

```ts
export interface GridEpicCtx<TRow> {
  readonly view: GridView<TRow>
  readonly columns: Signal<readonly ColumnDef<TRow>[]>
  readonly viewport: Signal<Viewport>
  /** Pixels of one row. Density lives in `grid()`, so the resolved height is handed down. */
  readonly rowHeight: (row: RowId) => number
  readonly overscan: number
}
```

### `GridEpic` {#src-7-epics-ts-gridepic}

`GridEpic` is declared at `src/7_epics.ts:58`.

```ts
export type GridEpic<TRow> = Epic<GridAction<TRow>, GridState, GridEpicCtx<TRow>>

export function sortOnHeaderClick<TRow>(): GridEpic<TRow>
```

### `DragMode` {#src-7-epics-ts-dragmode}

`DragMode` is declared at `src/7_epics.ts:81`.

`live` writes the grid on every pointermove. `preview` publishes where the gesture will land,
leaves every width and every order where it is, and writes once on the lift.

```ts
export type DragMode = "live" | "preview"
```

### `DEFAULT_DRAG_MODE` {#src-7-epics-ts-default-drag-mode}

`DEFAULT_DRAG_MODE` is declared at `src/7_epics.ts:83`.

```ts
DEFAULT_DRAG_MODE: DragMode
```

### `sortOnHeaderClick` {#src-7-epics-ts-sortonheaderclick}

`sortOnHeaderClick` is declared at `src/7_epics.ts:128`.

```ts
sortOnHeaderClick: <TRow>() => GridEpic<TRow>
```

### `expandOnExpanderClick` {#src-7-epics-ts-expandonexpanderclick}

`expandOnExpanderClick` is declared at `src/7_epics.ts:158`.

```ts
expandOnExpanderClick: <TRow>() => GridEpic<TRow>
```

### `expandOnCellDoubleClick` {#src-7-epics-ts-expandoncelldoubleclick}

`expandOnCellDoubleClick` is declared at `src/7_epics.ts:170`.

The second way into a tree, for a schema that draws no glyph. Opt-in, and it composes with
`expandOnExpanderClick`, because a double click on the glyph arrives `interactive`.

```ts
expandOnCellDoubleClick: <TRow>() => GridEpic<TRow>
```

### `selectRowsOnCheckboxClick` {#src-7-epics-ts-selectrowsoncheckboxclick}

`selectRowsOnCheckboxClick` is declared at `src/7_epics.ts:227`.

```ts
selectRowsOnCheckboxClick: <TRow>() => GridEpic<TRow>
```

### `selectRowsOnCellClick` {#src-7-epics-ts-selectrowsoncellclick}

`selectRowsOnCellClick` is declared at `src/7_epics.ts:236`.

Selection for a schema with no checkbox column. Opt-in: a cell holding a link or a button wants
that click, and `interactive` is the intent saying one took it.

```ts
selectRowsOnCellClick: <TRow>() => GridEpic<TRow>
```

### `toggleSelectAllOnHeaderClick` {#src-7-epics-ts-toggleselectallonheaderclick}

`toggleSelectAllOnHeaderClick` is declared at `src/7_epics.ts:257`.

In `defaultEpics`: the header draws the tri-state whether or not this is installed, and
installing it is what makes the header a control.

```ts
toggleSelectAllOnHeaderClick: <TRow>() => GridEpic<TRow>
```

### `toggleExpandAllOnHeaderClick` {#src-7-epics-ts-toggleexpandallonheaderclick}

`toggleExpandAllOnHeaderClick` is declared at `src/7_epics.ts:270`.

The mirror on the expand column, reading the same rows `expandAllSignal` counts.

```ts
toggleExpandAllOnHeaderClick: <TRow>() => GridEpic<TRow>
```

### `activateOnCellClick` {#src-7-epics-ts-activateoncellclick}

`activateOnCellClick` is declared at `src/7_epics.ts:285`.

The only way a consumer hears "the user picked this row". Modified clicks belong elsewhere.

```ts
activateOnCellClick: <TRow>() => GridEpic<TRow>
```

### `resizeOnHeaderDrag` {#src-7-epics-ts-resizeonheaderdrag}

`resizeOnHeaderDrag` is declared at `src/7_epics.ts:311`.

```ts
resizeOnHeaderDrag: <TRow>(streams?: DragStreams | undefined, mode?: DragMode) => GridEpic<TRow>
```

### `moveColumnOnHeaderDrag` {#src-7-epics-ts-movecolumnonheaderdrag}

`moveColumnOnHeaderDrag` is declared at `src/7_epics.ts:382`.

```ts
moveColumnOnHeaderDrag: <TRow>(streams?: DragStreams | undefined, mode?: DragMode) => GridEpic<TRow>
```

### `moveRowOnRowDrag` {#src-7-epics-ts-moverowonrowdrag}

`moveRowOnRowDrag` is declared at `src/7_epics.ts:441`.

```ts
moveRowOnRowDrag: <TRow>(streams?: DragStreams | undefined) => GridEpic<TRow>
```

### `keyboardNav` {#src-7-epics-ts-keyboardnav}

`keyboardNav` is declared at `src/7_epics.ts:549`.

```ts
keyboardNav: <TRow>() => GridEpic<TRow>
```

### `pageOnScrollNearEnd` {#src-7-epics-ts-pageonscrollnearend}

`pageOnScrollNearEnd` is declared at `src/7_epics.ts:561`.

```ts
pageOnScrollNearEnd: <TRow>() => GridEpic<TRow>
```

### `selectCellsOnDrag` {#src-7-epics-ts-selectcellsondrag}

`selectCellsOnDrag` is declared at `src/7_epics.ts:685`.

```ts
selectCellsOnDrag: <TRow>(streams?: DragStreams | undefined) => GridEpic<TRow>
```

### `selectRowsOnDrag` {#src-7-epics-ts-selectrowsondrag}

`selectRowsOnDrag` is declared at `src/7_epics.ts:704`.

```ts
selectRowsOnDrag: <TRow>(streams?: DragStreams | undefined) => GridEpic<TRow>
```

### `selectColumnsOnDrag` {#src-7-epics-ts-selectcolumnsondrag}

`selectColumnsOnDrag` is declared at `src/7_epics.ts:724`.

```ts
selectColumnsOnDrag: <TRow>(streams?: DragStreams | undefined, opensOn?: (part: string) => boolean) => GridEpic<TRow>
```

### `defaultEpics` {#src-7-epics-ts-defaultepics}

`defaultEpics` is declared at `src/7_epics.ts:748`.

Every epic `grid()` installs. Each is exported alone so a consumer can drop one.

```ts
defaultEpics: <TRow>(streams?: DragStreams | undefined, mode?: DragMode) => readonly GridEpic<TRow>[]
```

## src/8_grid.ts

The constructor.

| export | kind |
| --- | --- |
| [`GridSource`](#src-8-grid-ts-gridsource) | type |
| [`toGridSignal`](#src-8-grid-ts-togridsignal) | function |
| [`DEFAULT_PAGE`](#src-8-grid-ts-default-page) | const |
| [`defaultState`](#src-8-grid-ts-defaultstate) | function |
| [`ROW_HEIGHT`](#src-8-grid-ts-row-height) | const |
| [`GridConfig`](#src-8-grid-ts-gridconfig) | interface |
| [`GridView`](#src-8-grid-ts-gridview) | interface |
| [`Grid`](#src-8-grid-ts-grid) | interface |
| [`pageWindow`](#src-8-grid-ts-pagewindow) | function |
| [`grid`](#src-8-grid-ts-grid-2) | function |

### `GridSource` {#src-8-grid-ts-gridsource}

`GridSource` is declared at `src/8_grid.ts:75`.

Every input accepts any source shape, so a live input and a static one are the same call.
`@hafley66/signals` already carries this as `SignalSource`; the grid adds a fallback so a live
source that has not emitted yet still has a first value to derive from.

```ts
export type GridSource<T> = Signal<T> | Observable<T> | (() => T) | T

export function toGridSignal<T>(source: GridSource<T>, fallback: T): Signal<T>
```

### `toGridSignal` {#src-8-grid-ts-togridsignal}

`toGridSignal` is declared at `src/8_grid.ts:77`.

```ts
toGridSignal: <T>(source: GridSource<T>, fallback: T) => Signal<T>
```

### `DEFAULT_PAGE` {#src-8-grid-ts-default-page}

`DEFAULT_PAGE` is declared at `src/8_grid.ts:89`.

```ts
DEFAULT_PAGE: Page
```

### `defaultState` {#src-8-grid-ts-defaultstate}

`defaultState` is declared at `src/8_grid.ts:91`.

```ts
defaultState: (over?: Partial<GridState>) => GridState
```

### `ROW_HEIGHT` {#src-8-grid-ts-row-height}

`ROW_HEIGHT` is declared at `src/8_grid.ts:125`.

```ts
ROW_HEIGHT: Record<"comfortable" | "compact" | "standard", number>
```

### `GridConfig` {#src-8-grid-ts-gridconfig}

`GridConfig` is declared at `src/8_grid.ts:133`.

```ts
export interface GridConfig<TRow> {
  readonly id: GridSource<string>
  readonly rows: GridSource<readonly TRow[]>
  readonly columns: GridSource<readonly ColumnDef<TRow>[]>
  /** Identity is deliberately not reactive: a changing row id is a data reload, not a state change. */
  readonly rowId: (row: TRow) => RowId
  /** Supplying this is the whole of tree mode. */
  readonly subRows?: (row: TRow) => readonly TRow[] | undefined
  /** Where the whole row points. `ColumnDef.href` beats it per column, and a built-in glyph column
   * is never covered by it, because those cells hold a control of their own. */
  readonly rowHref?: (row: TRow) => string | undefined
  readonly mode?: GridMode
  /** Server mode: total rows behind the query, so the scrollbar can measure the whole result. */
  readonly rowCount?: GridSource<number | null>
  /** A signal is controlled in both directions, and every other shape seeds and stops there. The
   * grid keeps its own full state and mirrors, since a `Partial` behind the read is a hole. */
  readonly state?: GridSource<Partial<GridState>>
  /** A url query key. `true` uses the grid id. @feature-declared data.state */
  readonly sync?: string | boolean
  readonly slots?: Slots<TRow>
  readonly viewport?: GridSource<Viewport>
  readonly overscan?: number
  /** Absent installs `defaultEpics()`. Opt-in epics such as `detailOnCellClick` go here. */
  readonly epics?: readonly GridEpic<TRow>[]
  /** How a resize or a move shows itself while the pointer is down. Read only when `epics` is
   * absent, because a caller listing epics already chose the mode on each one. */
  readonly drag?: DragMode
}

export function grid<TRow>(config: GridConfig<TRow>): Grid<TRow>
```

### `GridView` {#src-8-grid-ts-gridview}

`GridView` is declared at `src/8_grid.ts:164`.

```ts
export interface GridView<TRow> {
  /** Source rows as an ordered forest. Flat when `subRows` is absent. */
  readonly base: Signal<Axis<RowId, TRow>>
  readonly grouped: Signal<Axis<RowId, TRow>>
  readonly sorted: Signal<Axis<RowId, TRow>>
  /** `sorted` plus one node per open panel. What `flat` walks. @feature-declared row.detail */
  readonly detailed: Signal<Axis<RowId, TRow>>
  readonly flat: Signal<readonly FlatNode<RowId>[]>
  /**
   * The two seats, already assigned. `vertical` is whatever `orientation` put on the y dimension,
   * so a consumer that wants the axis that scrolls asks for it by direction and never by name.
   */
  readonly vertical: Signal<AxisFacet<string, unknown>>
  readonly horizontal: Signal<AxisFacet<string, unknown>>
  /** The windowed vertical run. Rows under `"rows"`, columns under `"columns"`. */
  readonly plan: Signal<RenderPlan<RowId>>
  /** The horizontal run, one cell of every vertical entry. */
  readonly cols: Signal<readonly FlatNode<ColId>[]>
  /** `cols` with the header bands dropped, so every entry left holds a seat. */
  readonly colLeaves: Signal<readonly ColId[]>
  /** The horizontal run partitioned into its three sticky runs, its center windowed. */
  readonly colPlan: Signal<RenderPlan<ColId>>
  /** The pixels `colPlan` skipped, as the two tracks that hold the window's place. */
  readonly colSpacers: Signal<Spacers>
  readonly widths: Signal<ReadonlyMap<ColId, number>>
  /** Spanning as a relation over the cross, keyed vertical/horizontal so it transposes. */
  readonly spans: Signal<SpanRelation>
  /** Cells a neighbour's span already occupies. A covered cell renders nothing. */
  readonly covered: Signal<ReadonlySet<CellId>>
}
```

### `Grid` {#src-8-grid-ts-grid}

`Grid` is declared at `src/8_grid.ts:195`.

```ts
export interface Grid<TRow> {
  readonly id: Signal<string>
  readonly mode: GridMode
  readonly state: Signal<GridState>
  readonly rows: Signal<readonly TRow[]>
  readonly columns: Signal<readonly ColumnDef<TRow>[]>
  readonly view: GridView<TRow>
  readonly viewport: Signal<Viewport>
  readonly actions$: Observable<GridAction<TRow>>
  readonly intent$: Observable<GridIntent>
  readonly change$: Observable<GridChange>
  readonly effect$: Observable<GridEffect<TRow>>
  /** Server mode reads this and fetches. Client mode ignores it. */
  readonly query: Signal<QueryDescriptor>
  /** Fires when an infinite page boundary is crossed. Nothing in the kernel waits on it. */
  readonly page$: Observable<PageRequest>
  readonly dispatch: (action: GridAction<TRow>) => void
  readonly epics$: Observable<never>
  /** The one door DOM events come in by. Returns the teardown for every listener it opened. */
  readonly bind: (root: HTMLElement) => () => void
  /**
   * Releases what the constructor opened: the url sync listener and both directions of the state
   * mirror.
   * Idempotent, and unrelated to `bind` and `render`, which each hand back their own teardown.
   */
  readonly close: () => void
  readonly slots: Slots<TRow>
  readonly rowId: (row: TRow) => RowId
  readonly rowHref?: (row: TRow) => string | undefined
}

export function grid<TRow>(config: GridConfig<TRow>): Grid<TRow>
```

### `pageWindow` {#src-8-grid-ts-pagewindow}

`pageWindow` is declared at `src/8_grid.ts:243`.

The three retention rules of `PageMode` expressed as one `paginate` call, so paging runs inside
`renderPlan` after pinning has already been lifted out. Paging before pinning drops pinned
rows off the page they happen not to sit on, which defeats the point of pinning them.

```ts
pageWindow: (page: Page) => { page: { index: number; size: number; }; enabled: boolean; }
```

### `grid` {#src-8-grid-ts-grid-2}

`grid` is declared at `src/8_grid.ts:257`.

```ts
grid: <TRow>(config: GridConfig<TRow>) => Grid<TRow>
```

## src/9_css.ts

Changing a grid track triggers one full layout, so the cost of a resize is how often the track list is written, not how it is built.

| export | kind |
| --- | --- |
| [`SG_ROW_H`](#src-9-css-ts-sg-row-h) | const |
| [`SG_TOTAL_H`](#src-9-css-ts-sg-total-h) | const |
| [`SG_OFFSET_Y`](#src-9-css-ts-sg-offset-y) | const |
| [`SG_INLINE_TRACKS`](#src-9-css-ts-sg-inline-tracks) | const |
| [`SG_ROW_HEIGHT_SELF`](#src-9-css-ts-sg-row-height-self) | const |
| [`writeGridVars`](#src-9-css-ts-writegridvars) | function |

### `SG_ROW_H` {#src-9-css-ts-sg-row-h}

`SG_ROW_H` is declared at `src/9_css.ts:12`.

Density in pixels. The row box reads it, and so does the sticky top of the pinned row run.

```ts
SG_ROW_H: "--sg-row-h"
```

### `SG_TOTAL_H` {#src-9-css-ts-sg-total-h}

`SG_TOTAL_H` is declared at `src/9_css.ts:14`.

Scroll spacer height. Measures the paginated center run, not the whole relation.

```ts
SG_TOTAL_H: "--sg-total-h"
```

### `SG_OFFSET_Y` {#src-9-css-ts-sg-offset-y}

`SG_OFFSET_Y` is declared at `src/9_css.ts:16`.

Pixels above the first rendered row, applied as a translate on the rendered run.

```ts
SG_OFFSET_Y: "--sg-offset-y"
```

### `SG_INLINE_TRACKS` {#src-9-css-ts-sg-inline-tracks}

`SG_INLINE_TRACKS` is declared at `src/9_css.ts:19`.

`grid-template-columns` for the horizontal run. Named for the direction because under
`orientation: "columns"` that run holds rows and the tracks still describe the inline axis.

```ts
SG_INLINE_TRACKS: "--sg-inline-tracks"
```

### `SG_ROW_HEIGHT_SELF` {#src-9-css-ts-sg-row-height-self}

`SG_ROW_HEIGHT_SELF` is declared at `src/9_css.ts:22`.

The height one row box reads. Its own property is named after its id, which no selector can
spell, so the row carries this alias and one generic rule serves every row.

```ts
SG_ROW_HEIGHT_SELF: "--sg-h"
```

### `writeGridVars` {#src-9-css-ts-writegridvars}

`writeGridVars` is declared at `src/9_css.ts:40`.

Writes every geometry property onto `root` from one derived node, so two sources changing in
the same tick cannot paint two different frames.

```ts
writeGridVars: <TRow>(grid: Grid<TRow>, root: HTMLElement) => () => void
```

## src/10_render.ts

Plain DOM.

| export | kind |
| --- | --- |
| [`RenderHandle`](#src-10-render-ts-renderhandle) | interface |
| [`render`](#src-10-render-ts-render) | function |

### `RenderHandle` {#src-10-render-ts-renderhandle}

`RenderHandle` is declared at `src/10_render.ts:66`.

```ts
export interface RenderHandle {
  readonly stop: () => void
}

export function render<TRow>(grid: Grid<TRow>, root: HTMLElement): RenderHandle
```

### `render` {#src-10-render-ts-render}

`render` is declared at `src/10_render.ts:167`.

```ts
render: <TRow>(grid: Grid<TRow>, root: HTMLElement) => RenderHandle
```

## src/11_detail.ts

A detail row is a real node in the row axis, model (a).

| export | kind |
| --- | --- |
| [`DetailKey`](#src-11-detail-ts-detailkey) | type |
| [`DETAIL_PREFIX`](#src-11-detail-ts-detail-prefix) | const |
| [`isDetailKey`](#src-11-detail-ts-isdetailkey) | const |
| [`detailKeyFor`](#src-11-detail-ts-detailkeyfor) | const |
| [`rowOfDetailKey`](#src-11-detail-ts-rowofdetailkey) | const |
| [`DetailOpen`](#src-11-detail-ts-detailopen) | type |
| [`DetailChange`](#src-11-detail-ts-detailchange) | type |
| [`openDetail`](#src-11-detail-ts-opendetail) | function |
| [`closeDetail`](#src-11-detail-ts-closedetail) | function |
| [`toggleDetail`](#src-11-detail-ts-toggledetail) | function |
| [`withDetail`](#src-11-detail-ts-withdetail) | function |
| [`detailHeights`](#src-11-detail-ts-detailheights) | function |
| [`DetailEpicOptions`](#src-11-detail-ts-detailepicoptions) | interface |
| [`DetailEpic`](#src-11-detail-ts-detailepic) | type |
| [`detailOnCellClick`](#src-11-detail-ts-detailoncellclick) | function |

### `DetailKey` {#src-11-detail-ts-detailkey}

`DetailKey` is declared at `src/11_detail.ts:37`.

```ts
export type DetailKey = string
```

### `DETAIL_PREFIX` {#src-11-detail-ts-detail-prefix}

`DETAIL_PREFIX` is declared at `src/11_detail.ts:41`.

```ts
DETAIL_PREFIX: string
```

### `isDetailKey` {#src-11-detail-ts-isdetailkey}

`isDetailKey` is declared at `src/11_detail.ts:43`.

```ts
isDetailKey: (key: string) => boolean
```

### `detailKeyFor` {#src-11-detail-ts-detailkeyfor}

`detailKeyFor` is declared at `src/11_detail.ts:45`.

```ts
detailKeyFor: (row: string) => string
```

### `rowOfDetailKey` {#src-11-detail-ts-rowofdetailkey}

`rowOfDetailKey` is declared at `src/11_detail.ts:48`.

Not a detail key means the caller already holds the row, so it answers itself.

```ts
rowOfDetailKey: (key: string) => string
```

### `DetailOpen` {#src-11-detail-ts-detailopen}

`DetailOpen` is declared at `src/11_detail.ts:54`.

Which cell opened the panel. `true` is a panel opened by something other than a cell.

```ts
export type DetailOpen = Readonly<Record<RowId, ColId | true>>
```

### `DetailChange` {#src-11-detail-ts-detailchange}

`DetailChange` is declared at `src/11_detail.ts:56`.

```ts
export type DetailChange = { phase: "change"; type: "detail"; detail: DetailOpen }
```

### `openDetail` {#src-11-detail-ts-opendetail}

`openDetail` is declared at `src/11_detail.ts:61`.

Recording the column, not just a flag, is what lets a second cell swap the panel's contents.

```ts
openDetail: (state: HasDetail, row: string, col: string) => Partial<GridState>
```

### `closeDetail` {#src-11-detail-ts-closedetail}

`closeDetail` is declared at `src/11_detail.ts:69`.

```ts
closeDetail: (state: HasDetail, row: string) => Partial<GridState>
```

### `toggleDetail` {#src-11-detail-ts-toggledetail}

`toggleDetail` is declared at `src/11_detail.ts:78`.

```ts
toggleDetail: (state: HasDetail, row: string, col: string) => Partial<GridState>
```

### `withDetail` {#src-11-detail-ts-withdetail}

`withDetail` is declared at `src/11_detail.ts:89`.

One node per open row, inserted right after it in its sibling list.

```ts
withDetail: <K extends string, T>(axis: Axis<K, T>, open: Readonly<Record<string, string | true>>, make: (row: string) => T | undefined) => Axis<K, T>
```

### `detailHeights` {#src-11-detail-ts-detailheights}

`detailHeights` is declared at `src/11_detail.ts:138`.

```ts
detailHeights: (open: Readonly<Record<string, string | true>>, height: number, base?: Readonly<Record<string, number>>) => Readonly<Record<string, number>>
```

### `DetailEpicOptions` {#src-11-detail-ts-detailepicoptions}

`DetailEpicOptions` is declared at `src/11_detail.ts:153`.

```ts
export interface DetailEpicOptions {
  /** Absent means every column opens the panel, which is the whole-row disclosure case. */
  readonly columns?: readonly ColId[]
  /** `swap` never closes, for a panel that is a preview pane rather than a disclosure. */
  readonly mode?: "toggle" | "swap"
}

export function detailOnCellClick<TRow>(opts: DetailEpicOptions = {}): DetailEpic<TRow>
```

### `DetailEpic` {#src-11-detail-ts-detailepic}

`DetailEpic` is declared at `src/11_detail.ts:162`.

```ts
export type DetailEpic<TRow> = (
  actions$: Observable<GridAction<TRow>>,
  state: Signal<GridState>,
  ctx: GridEpicCtx<TRow>,
) => Observable<DetailChange>

export function detailOnCellClick<TRow>(opts: DetailEpicOptions = {}): DetailEpic<TRow>
```

### `detailOnCellClick` {#src-11-detail-ts-detailoncellclick}

`detailOnCellClick` is declared at `src/11_detail.ts:169`.

Opt-in, so a plain grid still reduces a cell click to nothing but `activate`.

```ts
detailOnCellClick: <TRow>(opts?: DetailEpicOptions) => DetailEpic<TRow>
```

## src/12_transpose.ts

The one place the two-axis design stopped being two-axis.

| export | kind |
| --- | --- |
| [`AxisPair`](#src-12-transpose-ts-axispair) | type |
| [`Orientation`](#src-12-transpose-ts-orientation) | re-export |
| [`transpose`](#src-12-transpose-ts-transpose) | const |
| [`verticalOf`](#src-12-transpose-ts-verticalof) | const |
| [`horizontalOf`](#src-12-transpose-ts-horizontalof) | const |
| [`AxisFacet`](#src-12-transpose-ts-axisfacet) | interface |
| [`FacetPair`](#src-12-transpose-ts-facetpair) | type |
| [`verticalFacet`](#src-12-transpose-ts-verticalfacet) | const |
| [`horizontalFacet`](#src-12-transpose-ts-horizontalfacet) | const |
| [`collapseToOneEntry`](#src-12-transpose-ts-collapsetooneentry) | function |
| [`CellSpan`](#src-12-transpose-ts-cellspan) | interface |
| [`SpanRelation`](#src-12-transpose-ts-spanrelation) | type |
| [`NO_SPANS`](#src-12-transpose-ts-no-spans) | const |
| [`NO_COVER`](#src-12-transpose-ts-no-cover) | const |
| [`neutralSpan`](#src-12-transpose-ts-neutralspan) | function |
| [`neutralCell`](#src-12-transpose-ts-neutralcell) | function |
| [`conventionalParts`](#src-12-transpose-ts-conventionalparts) | function |
| [`NO_ENTRY`](#src-12-transpose-ts-no-entry) | const |
| [`AddressedEntry`](#src-12-transpose-ts-addressedentry) | interface |
| [`addressedEntry`](#src-12-transpose-ts-addressedentry-2) | function |
| [`transposeSpans`](#src-12-transpose-ts-transposespans) | function |
| [`coveredBy`](#src-12-transpose-ts-coveredby) | function |

### `AxisPair` {#src-12-transpose-ts-axispair}

`AxisPair` is declared at `src/12_transpose.ts:17`.

Seat 0 always holds the row axis, seat 1 the column axis. Fixed, so a pair is built inline.

```ts
export type AxisPair<T> = readonly [T, T]
```

### `Orientation` {#src-12-transpose-ts-orientation}

`Orientation` is declared at `src/12_transpose.ts:28`.

```ts
Orientation: any
```

### `transpose` {#src-12-transpose-ts-transpose}

`transpose` is declared at `src/12_transpose.ts:36`.

Its own inverse, which is what a round trip rests on.

```ts
transpose: (orientation: Orientation) => Orientation
```

### `verticalOf` {#src-12-transpose-ts-verticalof}

`verticalOf` is declared at `src/12_transpose.ts:39`.

Picks the seat standing on the y dimension. The vertical run is the one that scrolls and pages.

```ts
verticalOf: <T>(pair: AxisPair<T>, orientation: Orientation) => T
```

### `horizontalOf` {#src-12-transpose-ts-horizontalof}

`horizontalOf` is declared at `src/12_transpose.ts:43`.

Picks the other seat. Always the complement, so the two can never name the same axis.

```ts
horizontalOf: <T>(pair: AxisPair<T>, orientation: Orientation) => T
```

### `AxisFacet` {#src-12-transpose-ts-axisfacet}

`AxisFacet` is declared at `src/12_transpose.ts:56`.

Everything a run needs off one axis, gathered so the pipeline can be handed either seat.

`extent` is the entry's declared size along whichever direction it lands in: `rowHeight` for the
row seat, `colWidth` for the column seat. The direction supplies the fallback rather than the
axis, so a column standing on the y dimension is one row height tall and a row lying on the x
dimension is one column wide.

```ts
export interface AxisFacet<K extends string, T> {
  readonly axis: Axis<K, T>
  readonly nodes: readonly FlatNode<K>[]
  readonly pinning: Readonly<Record<K, Side>>
  readonly extent: Readonly<Record<K, number>>
}
```

### `FacetPair` {#src-12-transpose-ts-facetpair}

`FacetPair` is declared at `src/12_transpose.ts:68`.

Each seat is a thunk, so only the chosen one is ever evaluated. Reading both would put the
column state on the row plan's dependency list, and a column resize drag would then rebuild the
row window on every pointermove for a value it did not use.

```ts
export type FacetPair<K extends string, T> = AxisPair<() => AxisFacet<K, T>>
```

### `verticalFacet` {#src-12-transpose-ts-verticalfacet}

`verticalFacet` is declared at `src/12_transpose.ts:70`.

```ts
verticalFacet: <K extends string, T>(pair: FacetPair<K, T>, orientation: Orientation) => AxisFacet<K, T>
```

### `horizontalFacet` {#src-12-transpose-ts-horizontalfacet}

`horizontalFacet` is declared at `src/12_transpose.ts:75`.

```ts
horizontalFacet: <K extends string, T>(pair: FacetPair<K, T>, orientation: Orientation) => AxisFacet<K, T>
```

### `collapseToOneEntry` {#src-12-transpose-ts-collapsetooneentry}

`collapseToOneEntry` is declared at `src/12_transpose.ts:89`.

List view is the degenerate transpose: the horizontal axis keeps one entry, so every vertical
entry renders as a single cell. Same lever one notch further, not a second rendering mode.

The survivor is the first leaf. A header group is a band over its leaves, and a band of one leaf
is the leaf, so keeping the group node instead would leave a run whose only entry has no cell.

```ts
collapseToOneEntry: <K extends string>(nodes: readonly FlatNode<K>[], on: boolean) => readonly FlatNode<K>[]
```

### `CellSpan` {#src-12-transpose-ts-cellspan}

`CellSpan` is declared at `src/12_transpose.ts:106`.

How far one cell reaches past its own seat, counted in entries rather than pixels. Both counts
are at least 1, and `{ vertical: 1, horizontal: 1 }` is a cell that spans nothing.

```ts
export interface CellSpan {
  readonly vertical: number
  readonly horizontal: number
}
```

### `SpanRelation` {#src-12-transpose-ts-spanrelation}

`SpanRelation` is declared at `src/12_transpose.ts:116`.

Spanning as a relation over the cross rather than a per-column callback. The key is
`cellId(verticalKey, horizontalKey)`, so a transpose is a swap of both halves and nothing else,
and no consumer has to know a column ever had an opinion about it.

```ts
export type SpanRelation = ReadonlyMap<CellId, CellSpan>

export function transposeSpans(spans: SpanRelation): SpanRelation
```

### `NO_SPANS` {#src-12-transpose-ts-no-spans}

`NO_SPANS` is declared at `src/12_transpose.ts:118`.

```ts
NO_SPANS: SpanRelation
```

### `NO_COVER` {#src-12-transpose-ts-no-cover}

`NO_COVER` is declared at `src/12_transpose.ts:119`.

```ts
NO_COVER: ReadonlySet<string>
```

### `neutralSpan` {#src-12-transpose-ts-neutralspan}

`neutralSpan` is declared at `src/12_transpose.ts:128`.

The boundary, crossed once. A `ColumnDef.span` speaks rows and columns because that is what a
table config has always spelled; the seating chart turns the pair into a neutral one and the
kernel never sees the conventional names again.

```ts
neutralSpan: (span: { readonly rows?: number | undefined; readonly cols?: number | undefined; }, orientation: Orientation) => CellSpan
```

### `neutralCell` {#src-12-transpose-ts-neutralcell}

`neutralCell` is declared at `src/12_transpose.ts:137`.

The same crossing for the address. `cellId` is already a tuple, so only the seat order moves.

```ts
neutralCell: (row: string, col: string, orientation: Orientation) => string
```

### `conventionalParts` {#src-12-transpose-ts-conventionalparts}

`conventionalParts` is declared at `src/12_transpose.ts:150`.

The crossing read back the other way, for a renderer holding a vertical and a horizontal key and
needing the row and the column behind them.

The same body as `neutralCell` because the map is an involution: seat 0 is the row axis, and
asking the seat table which seat stands vertical returns the pair to conventional order exactly
as sending it the other way took it out of one.

```ts
conventionalParts: (vertical: string, horizontal: string, orientation: Orientation) => readonly [string, string]
```

### `NO_ENTRY` {#src-12-transpose-ts-no-entry}

`NO_ENTRY` is declared at `src/12_transpose.ts:160`.

The empty half of a one-axis address, which the header band stands on. No axis holds `""`.

```ts
NO_ENTRY: ""
```

### `AddressedEntry` {#src-12-transpose-ts-addressedentry}

`AddressedEntry` is declared at `src/12_transpose.ts:164`.

The four things a renderer wants off a seat pair. `def` and `data` are `undefined` on a seat
holding `NO_ENTRY`, and on a live key the map has no entry for.

```ts
export interface AddressedEntry<TCol, TRow> {
  readonly row: RowId
  readonly col: ColId
  readonly def: TCol | undefined
  readonly data: TRow | undefined
}
```

### `addressedEntry` {#src-12-transpose-ts-addressedentry-2}

`addressedEntry` is declared at `src/12_transpose.ts:173`.

`conventionalParts` with both lookups attached, so the key that addresses the data is chosen by
the seat table once rather than once per caller. A second copy is a second code path.

```ts
addressedEntry: <TCol, TRow>(vertical: string, horizontal: string, orientation: Orientation, defs: ReadonlyMap<string, TCol>, by: ReadonlyMap<string, TRow>) => AddressedEntry<...>
```

### `transposeSpans` {#src-12-transpose-ts-transposespans}

`transposeSpans` is declared at `src/12_transpose.ts:190`.

Swaps both halves of every entry. Applied twice it is the identity, which is the proof.

```ts
transposeSpans: (spans: SpanRelation) => SpanRelation
```

### `coveredBy` {#src-12-transpose-ts-coveredby}

`coveredBy` is declared at `src/12_transpose.ts:209`.

Every cell a span reaches that is not the anchor itself. A covered cell renders nothing: the
neighbour already occupies the space, and two elements in one seat is how a spanning grid tears.

Both key lists arrive in run order, because a span reaches the next entries along each dimension
and "next" is only defined by that order. Nothing here knows which list holds rows.

```ts
coveredBy: (spans: SpanRelation, vertical: readonly string[], horizontal: readonly string[]) => ReadonlySet<string>
```

## src/13_composite.ts

One cell, several source columns.

| export | kind |
| --- | --- |
| [`CompositeRank`](#src-13-composite-ts-compositerank) | type |
| [`CompositePart`](#src-13-composite-ts-compositepart) | interface |
| [`ColumnSource`](#src-13-composite-ts-columnsource) | type |
| [`COMPOSITE_PREFIX`](#src-13-composite-ts-composite-prefix) | const |
| [`CompositeColumnDef`](#src-13-composite-ts-compositecolumndef) | interface |
| [`isComposite`](#src-13-composite-ts-iscomposite) | const |
| [`compositeParts`](#src-13-composite-ts-compositeparts) | function |
| [`CompositeColumnOptions`](#src-13-composite-ts-compositecolumnoptions) | interface |
| [`compositeColumn`](#src-13-composite-ts-compositecolumn) | function |

### `CompositeRank` {#src-13-composite-ts-compositerank}

`CompositeRank` is declared at `src/13_composite.ts:14`.

Presentation weight, not order: reordering `parts` carries the ranks with them.

```ts
export type CompositeRank = "primary" | "secondary" | "tertiary"
```

### `CompositePart` {#src-13-composite-ts-compositepart}

`CompositePart` is declared at `src/13_composite.ts:16`.

```ts
export interface CompositePart {
  readonly col: ColId
  readonly rank: CompositeRank
}
```

### `ColumnSource` {#src-13-composite-ts-columnsource}

`ColumnSource` is declared at `src/13_composite.ts:30`.

A thunk too, because a composite is usually built in the same expression as its own schema.

```ts
export type ColumnSource<TRow> =
```

### `COMPOSITE_PREFIX` {#src-13-composite-ts-composite-prefix}

`COMPOSITE_PREFIX` is declared at `src/13_composite.ts:45`.

Ids are user strings, so the generated one is namespaced the way the built-ins are.

```ts
COMPOSITE_PREFIX: "__composite:"
```

### `CompositeColumnDef` {#src-13-composite-ts-compositecolumndef}

`CompositeColumnDef` is declared at `src/13_composite.ts:47`.

```ts
export interface CompositeColumnDef<TRow> extends ColumnDef<TRow> {
  readonly composite: readonly CompositePart[]
}

export function compositeColumn<TRow>(opts: CompositeColumnOptions<TRow>): CompositeColumnDef<TRow>
```

### `isComposite` {#src-13-composite-ts-iscomposite}

`isComposite` is declared at `src/13_composite.ts:51`.

```ts
isComposite: <TRow>(col: ColumnDef<TRow, unknown>) => col is CompositeColumnDef<TRow>
```

### `compositeParts` {#src-13-composite-ts-compositeparts}

`compositeParts` is declared at `src/13_composite.ts:56`.

A cell stacks several columns as primary, secondary and tertiary parts.

```ts
compositeParts: <TRow>(def: ColumnDef<TRow, unknown>, columns?: ColumnSource<TRow> | undefined) => readonly CompositePart[]
```

### `CompositeColumnOptions` {#src-13-composite-ts-compositecolumnoptions}

`CompositeColumnOptions` is declared at `src/13_composite.ts:66`.

```ts
export interface CompositeColumnOptions<TRow> {
  readonly id?: ColId
  readonly header?: string
  readonly parts: readonly (ColId | CompositePart)[]
  /** Where each part's `value` accessor is read from. Absent means every part reads `row[col]`. */
  readonly columns?: ColumnSource<TRow>
  /** Replaces the default stack entirely. The ranks stay on the def for `compositeParts`. */
  readonly cell?: Slot<CellCtx<TRow>>
  readonly width?: number
  readonly minWidth?: number
  readonly flex?: number
  readonly pin?: Side
  /** Default true, sorting by the primary part. False makes the composite unsortable. */
  readonly sortable?: boolean
}

export function compositeColumn<TRow>(opts: CompositeColumnOptions<TRow>): CompositeColumnDef<TRow>
```

### `compositeColumn` {#src-13-composite-ts-compositecolumn}

`compositeColumn` is declared at `src/13_composite.ts:84`.

The composite's id names no field, so `value` points at the primary part and sorting is
the ordinary path with no special case. The primary's comparator comes along too.

```ts
compositeColumn: <TRow>(opts: CompositeColumnOptions<TRow>) => CompositeColumnDef<TRow>
```

## src/14_measure.ts

Real geometry, for the entries whose extent no config can declare.

| export | kind |
| --- | --- |
| [`MeasureDirection`](#src-14-measure-ts-measuredirection) | type |
| [`MeasureStore`](#src-14-measure-ts-measurestore) | interface |
| [`MeasureOptions`](#src-14-measure-ts-measureoptions) | interface |
| [`MeasureSnapshot`](#src-14-measure-ts-measuresnapshot) | interface |
| [`snapshotOf`](#src-14-measure-ts-snapshotof) | const |
| [`DEFAULT_BUFFER_PX`](#src-14-measure-ts-default-buffer-px) | const |
| [`createMeasureStore`](#src-14-measure-ts-createmeasurestore) | function |
| [`anchorAdjustment`](#src-14-measure-ts-anchoradjustment) | function |

### `MeasureDirection` {#src-14-measure-ts-measuredirection}

`MeasureDirection` is declared at `src/14_measure.ts:13`.

Measures rendered extents, with no kernel stage reading them yet.

```ts
export type MeasureDirection = "vertical" | "horizontal"
```

### `MeasureStore` {#src-14-measure-ts-measurestore}

`MeasureStore` is declared at `src/14_measure.ts:15`.

```ts
export interface MeasureStore {
  /** Keyed for the sizer, and live. Absent means "use the estimate". */
  readonly extents: ReadonlyMap<string, number>
  /** Observe an element under `key`, with both observers. Returns the release for both. */
  readonly observe: (key: string, el: HTMLElement) => () => void
  /** Rolling mean of what has been measured, the estimate for entries never rendered. */
  readonly estimate: () => number
  /** Keys entering the buffer zone, ahead of visibility. One emission per observer callback. */
  readonly approaching$: Observable<readonly string[]>
  /** Keys leaving it, so a consumer can release work it started. */
  readonly leaving$: Observable<readonly string[]>
  readonly close: () => void
}

export function createMeasureStore(opts: MeasureOptions): MeasureStore
```

### `MeasureOptions` {#src-14-measure-ts-measureoptions}

`MeasureOptions` is declared at `src/14_measure.ts:29`.

```ts
export interface MeasureOptions {
  /** The extent to assume before anything has been measured. */
  readonly initial: number
  /** Picks `contentRect.height` or `contentRect.width`, so the store transposes with everything. */
  readonly direction: MeasureDirection
  readonly onChange: (keys: readonly string[]) => void
  /** The scroll box. Null means the document viewport, which is what a page-scrolled grid has. */
  readonly root?: Element | null
  readonly bufferPx?: number
}

export function createMeasureStore(opts: MeasureOptions): MeasureStore
```

### `MeasureSnapshot` {#src-14-measure-ts-measuresnapshot}

`MeasureSnapshot` is declared at `src/14_measure.ts:41`.

A frozen read of the store, for a consumer whose invalidation compares by reference.

```ts
export interface MeasureSnapshot {
  readonly extents: ReadonlyMap<string, number>
  readonly estimate: number
}
```

### `snapshotOf` {#src-14-measure-ts-snapshotof}

`snapshotOf` is declared at `src/14_measure.ts:47`.

Copied, because `MeasureStore.extents` is live and a reference comparison would never move.

```ts
snapshotOf: (store: MeasureStore) => MeasureSnapshot
```

### `DEFAULT_BUFFER_PX` {#src-14-measure-ts-default-buffer-px}

`DEFAULT_BUFFER_PX` is declared at `src/14_measure.ts:53`.

Roughly five standard rows, so a fast scroll still measures before it paints.

```ts
DEFAULT_BUFFER_PX: 200
```

### `createMeasureStore` {#src-14-measure-ts-createmeasurestore}

`createMeasureStore` is declared at `src/14_measure.ts:63`.

```ts
createMeasureStore: (opts: MeasureOptions) => MeasureStore
```

### `anchorAdjustment` {#src-14-measure-ts-anchoradjustment}

`anchorAdjustment` is declared at `src/14_measure.ts:161`.

Pixels to add to `scrollTop` so the entry at `anchorIndex` holds its place. The delta is the
shift of its own start offset, so a correction below it answers zero with no special case.

```ts
anchorAdjustment: (before: Sizer, after: Sizer, anchorIndex: number) => number
```

## src/15_selection.ts

A range is two addresses and a mode, never a set of cells, so a drag across a million-cell rectangle costs what a drag across nine costs.

| export | kind |
| --- | --- |
| [`SelectionMode`](#src-15-selection-ts-selectionmode) | type |
| [`Block`](#src-15-selection-ts-block) | interface |
| [`GridSelection`](#src-15-selection-ts-gridselection) | interface |
| [`Rect`](#src-15-selection-ts-rect) | interface |
| [`EMPTY_RECT`](#src-15-selection-ts-empty-rect) | const |
| [`EMPTY_RANGE`](#src-15-selection-ts-empty-range) | const |
| [`columnAnchor`](#src-15-selection-ts-columnanchor) | const |
| [`rowAnchor`](#src-15-selection-ts-rowanchor) | const |
| [`rangeOf`](#src-15-selection-ts-rangeof) | function |
| [`liveBlock`](#src-15-selection-ts-liveblock) | function |
| [`blocksOf`](#src-15-selection-ts-blocksof) | function |
| [`isRangeEmpty`](#src-15-selection-ts-israngeempty) | const |
| [`rectOf`](#src-15-selection-ts-rectof) | function |
| [`selectionTest`](#src-15-selection-ts-selectiontest) | function |
| [`isSelected`](#src-15-selection-ts-isselected) | function |
| [`selectedKeys`](#src-15-selection-ts-selectedkeys) | function |
| [`beginAt`](#src-15-selection-ts-beginat) | function |
| [`extendTo`](#src-15-selection-ts-extendto) | function |
| [`commitBlock`](#src-15-selection-ts-commitblock) | function |
| [`clearSelection`](#src-15-selection-ts-clearselection) | function |

### `SelectionMode` {#src-15-selection-ts-selectionmode}

`SelectionMode` is declared at `src/15_selection.ts:9`.

`row` covers every horizontal key of its vertical span, `column` the mirror.

```ts
export type SelectionMode = "cell" | "row" | "column"
```

### `Block` {#src-15-selection-ts-block}

`Block` is declared at `src/15_selection.ts:11`.

```ts
export interface Block {
  readonly anchor: CellId
  readonly head: CellId
  readonly mode: SelectionMode
}

export function liveBlock(range: GridSelection): Block | null
```

### `GridSelection` {#src-15-selection-ts-gridselection}

`GridSelection` is declared at `src/15_selection.ts:17`.

```ts
export interface GridSelection {
  readonly anchor: CellId | null
  readonly head: CellId | null
  readonly mode: SelectionMode
  /** Ranges already committed, so ctrl-drag adds a second block rather than replacing the first. */
  readonly blocks: readonly Block[]
}

export function rangeOf(value: RangeSelection): GridSelection
```

### `Rect` {#src-15-selection-ts-rect}

`Rect` is declared at `src/15_selection.ts:26`.

The two ordered key lists a block covers. Empty in both when the block covers nothing.

```ts
export interface Rect {
  readonly vertical: readonly string[]
  readonly horizontal: readonly string[]
}
```

### `EMPTY_RECT` {#src-15-selection-ts-empty-rect}

`EMPTY_RECT` is declared at `src/15_selection.ts:34`.

```ts
EMPTY_RECT: Rect
```

### `EMPTY_RANGE` {#src-15-selection-ts-empty-range}

`EMPTY_RANGE` is declared at `src/15_selection.ts:36`.

```ts
EMPTY_RANGE: GridSelection
```

### `columnAnchor` {#src-15-selection-ts-columnanchor}

`columnAnchor` is declared at `src/15_selection.ts:44`.

A header names a horizontal entry only, and `rectOf` reads no vertical half for that mode.

```ts
columnAnchor: (horizontal: string) => string
```

### `rowAnchor` {#src-15-selection-ts-rowanchor}

`rowAnchor` is declared at `src/15_selection.ts:47`.

The mirror, for a gutter that names a vertical entry and no column.

```ts
rowAnchor: (vertical: string) => string
```

### `rangeOf` {#src-15-selection-ts-rangeof}

`rangeOf` is declared at `src/15_selection.ts:51`.

A rectangular range over two ordered axes, with edges for the border.

```ts
rangeOf: (value: RangeSelection) => GridSelection
```

### `liveBlock` {#src-15-selection-ts-liveblock}

`liveBlock` is declared at `src/15_selection.ts:59`.

The pair being dragged. Opened and never extended is one cell, never empty.

```ts
liveBlock: (range: GridSelection) => Block | null
```

### `blocksOf` {#src-15-selection-ts-blocksof}

`blocksOf` is declared at `src/15_selection.ts:66`.

Everything the range covers: the live pair first, then what earlier gestures committed.

```ts
blocksOf: (range: GridSelection) => readonly Block[]
```

### `isRangeEmpty` {#src-15-selection-ts-israngeempty}

`isRangeEmpty` is declared at `src/15_selection.ts:72`.

```ts
isRangeEmpty: (range: GridSelection) => boolean
```

### `rectOf` {#src-15-selection-ts-rectof}

`rectOf` is declared at `src/15_selection.ts:122`.

Both axis orders are handed in, so one call answers for either seating. `ordered` normalises.

```ts
rectOf: (block: Block, vertical: readonly string[], horizontal: readonly string[]) => Rect
```

### `selectionTest` {#src-15-selection-ts-selectiontest}

`selectionTest` is declared at `src/15_selection.ts:147`.

Both axes indexed once, so a renderer pays two map lookups and one comparison per block per cell.

```ts
selectionTest: (range: GridSelection, vertical: readonly string[], horizontal: readonly string[]) => (address: string) => boolean
```

### `isSelected` {#src-15-selection-ts-isselected}

`isSelected` is declared at `src/15_selection.ts:178`.

The live drag plus every committed block, for one address.

```ts
isSelected: (range: GridSelection, vertical: readonly string[], horizontal: readonly string[], address: string) => boolean
```

### `selectedKeys` {#src-15-selection-ts-selectedkeys}

`selectedKeys` is declared at `src/15_selection.ts:188`.

Keys covered along their whole run, which is what a row or a column highlight needs.

```ts
selectedKeys: (range: GridSelection, vertical: readonly string[], horizontal: readonly string[]) => Rect
```

### `beginAt` {#src-15-selection-ts-beginat}

`beginAt` is declared at `src/15_selection.ts:209`.

Additive keeps the earlier blocks. Anchor equal to head is one cell, never an empty range.

```ts
beginAt: (range: GridSelection, cell: string, mode: SelectionMode, additive: boolean) => GridSelection
```

### `extendTo` {#src-15-selection-ts-extendto}

`extendTo` is declared at `src/15_selection.ts:219`.

A range with no anchor takes the head as both, so an extend can open a block.

```ts
extendTo: (range: GridSelection, head: string) => GridSelection
```

### `commitBlock` {#src-15-selection-ts-commitblock}

`commitBlock` is declared at `src/15_selection.ts:224`.

The pair stays live for a following shift-click and joins `blocks` for a following ctrl-drag.

```ts
commitBlock: (range: GridSelection) => GridSelection
```

### `clearSelection` {#src-15-selection-ts-clearselection}

`clearSelection` is declared at `src/15_selection.ts:232`.

Identity when there was nothing to clear, so a repeated Escape writes no new state.

```ts
clearSelection: (range: GridSelection) => GridSelection
```

## src/16_menu.ts

A context menu is UI every application wants to own: its own items, its own icons, its own keyboard model, its own copy.

| export | kind |
| --- | --- |
| [`isMenuIntent`](#src-16-menu-ts-ismenuintent) | const |
| [`MenuTarget`](#src-16-menu-ts-menutarget) | interface |
| [`menuTargetOf`](#src-16-menu-ts-menutargetof) | function |
| [`supportsAnchorPositioning`](#src-16-menu-ts-supportsanchorpositioning) | function |
| [`anchorTo`](#src-16-menu-ts-anchorto) | function |

### `isMenuIntent` {#src-16-menu-ts-ismenuintent}

`isMenuIntent` is declared at `src/16_menu.ts:28`.

A context menu anchored to the cell it was raised on.

```ts
isMenuIntent: (intent: GridIntent) => intent is { phase: "intent"; type: "cell.contextmenu"; row: string; col: string; x: number; y: number; mods: Modifiers; } | { phase: "intent"; type: "header.contextmenu"; col: string; x: number; y: number; mods: Modifiers; } | { ...; }
```

### `MenuTarget` {#src-16-menu-ts-menutarget}

`MenuTarget` is declared at `src/16_menu.ts:35`.

```ts
export interface MenuTarget {
  readonly kind: "cell" | "row" | "header"
  readonly row: RowId | null
  readonly col: ColId | null
  readonly at: { readonly x: number; readonly y: number }
  /** The element to tether to, resolved through `selectorFor`. Null only on a hand-built target:
   * `menuTargetOf` answers an unresolvable element with a null target instead. */
  readonly anchor: HTMLElement | null
  /** A unique `anchor-name` written onto that element, for CSS anchor positioning. */
  readonly anchorName: string
}

export function anchorTo(target: MenuTarget, popover: HTMLElement): () => void
```

### `menuTargetOf` {#src-16-menu-ts-menutargetof}

`menuTargetOf` is declared at `src/16_menu.ts:94`.

The anchor and the address for one context-menu intent, or null when the element it named has
left the DOM, which is a menu that does not open rather than one that opens at the origin.

```ts
menuTargetOf: (intent: GridIntent, root: HTMLElement, orientation: Orientation) => MenuTarget | null
```

### `supportsAnchorPositioning` {#src-16-menu-ts-supportsanchorpositioning}

`supportsAnchorPositioning` is declared at `src/16_menu.ts:178`.

Read off `globalThis` at call time, so a document with no `CSS` object degrades instead of
throwing. Both properties are asked for: the name without the placement half renders at the origin.

```ts
supportsAnchorPositioning: () => boolean
```

### `anchorTo` {#src-16-menu-ts-anchorto}

`anchorTo` is declared at `src/16_menu.ts:191`.

Tethers `popover` to `target.anchor` and hands back the teardown. Nothing is appended and
nothing is shown: opening and light-dismiss belong to the Popover API, which is Baseline Widely.

```ts
anchorTo: (target: MenuTarget, popover: HTMLElement) => () => void
```

## src/18_bands.ts

The header band: the rows above the leaves, each cell covering the leaves of one group.

| export | kind |
| --- | --- |
| [`ColumnGroupDef`](#src-18-bands-ts-columngroupdef) | interface |
| [`isHeaderGroup`](#src-18-bands-ts-isheadergroup) | const |
| [`HeaderGroupOptions`](#src-18-bands-ts-headergroupoptions) | interface |
| [`headerGroup`](#src-18-bands-ts-headergroup) | function |
| [`checkBands`](#src-18-bands-ts-checkbands) | function |
| [`SG_HEAD_ROWS`](#src-18-bands-ts-sg-head-rows) | const |
| [`BandCell`](#src-18-bands-ts-bandcell) | interface |
| [`bandAncestors`](#src-18-bands-ts-bandancestors) | function |
| [`bandDepth`](#src-18-bands-ts-banddepth) | function |
| [`bandRow`](#src-18-bands-ts-bandrow) | function |

### `ColumnGroupDef` {#src-18-bands-ts-columngroupdef}

`ColumnGroupDef` is declared at `src/18_bands.ts:22`.

A band over its children. It holds no seat on either axis, and its label is `ColumnDef.header`,
the field a leaf labels itself with, so the one string a band owns needs no second vocabulary.

```ts
export interface ColumnGroupDef<TRow> extends ColumnDef<TRow> {
  readonly band: true
}

export function headerGroup<TRow>(opts: HeaderGroupOptions): ColumnGroupDef<TRow>
```

### `isHeaderGroup` {#src-18-bands-ts-isheadergroup}

`isHeaderGroup` is declared at `src/18_bands.ts:28`.

One predicate under both seatings: the horizontal axis holds rows under the transpose, and a row
carries no marker, so nothing below has to ask which axis it is looking at.

```ts
isHeaderGroup: (value: unknown) => boolean
```

### `HeaderGroupOptions` {#src-18-bands-ts-headergroupoptions}

`HeaderGroupOptions` is declared at `src/18_bands.ts:31`.

```ts
export interface HeaderGroupOptions {
  readonly id: ColId
  readonly header?: string
  /** A band nests by naming its own parent, through the field a leaf names one with. */
  readonly group?: ColId
}

export function headerGroup<TRow>(opts: HeaderGroupOptions): ColumnGroupDef<TRow>
```

### `headerGroup` {#src-18-bands-ts-headergroup}

`headerGroup` is declared at `src/18_bands.ts:58`.

```ts
headerGroup: <TRow>(opts: HeaderGroupOptions) => ColumnGroupDef<TRow>
```

### `checkBands` {#src-18-bands-ts-checkbands}

`checkBands` is declared at `src/18_bands.ts:76`.

A band that forgot its marker takes a track and renders a cell in every entry while the track
list counts leaves, so it is rejected beside the `field` and `value` check in `8_grid.ts`.

```ts
checkBands: <TRow>(columns: readonly ColumnDef<TRow, unknown>[]) => void
```

### `SG_HEAD_ROWS` {#src-18-bands-ts-sg-head-rows}

`SG_HEAD_ROWS` is declared at `src/18_bands.ts:96`.

The band rows the header built. The sticky offsets under the header read it, because that height
is the schema's band depth and no stylesheet selector can count elements.

```ts
SG_HEAD_ROWS: "--sg-head-rows"
```

### `BandCell` {#src-18-bands-ts-bandcell}

`BandCell` is declared at `src/18_bands.ts:99`.

One cell of one band row. A null key is a filler: a track no band covers at this level.

```ts
export interface BandCell {
  readonly key: ColId | null
  /** Leaf tracks the cell covers. Always at least one. */
  readonly span: number
}
```

### `bandAncestors` {#src-18-bands-ts-bandancestors}

`bandAncestors` is declared at `src/18_bands.ts:107`.

The bands over one entry, outermost first. The marker filter decides the depth and
`FlatNode.depth` never does, so a transposed tree of rows grows no header row.

```ts
bandAncestors: (axis: Axis<string, unknown>, key: string) => readonly string[]
```

### `bandDepth` {#src-18-bands-ts-banddepth}

`bandDepth` is declared at `src/18_bands.ts:117`.

One row per band level, plus the row the leaves sit on. Counted over the whole run rather than
the window, so a horizontal scroll cannot change the header's height under the reader.

```ts
bandDepth: (axis: Axis<string, unknown>, leaves: readonly string[]) => number
```

### `bandRow` {#src-18-bands-ts-bandrow}

`bandRow` is declared at `src/18_bands.ts:125`.

Row `rows - 1` holds the leaves, each row above the band covering every leaf at that level and a
filler where none does. Adjacent cells naming one key collapse into one span.

```ts
bandRow: (axis: Axis<string, unknown>, leaves: readonly string[], depth: number, rows: number) => readonly BandCell[]
```

