// The whole contract. Two ordered forests (rows, columns), five pure operators over them, side
// relations keyed by one axis or by the cross, and a three-phase action grammar.
//
// Nothing here imports a table library or React. `Axis` is the only container; a flat grid is an
// Axis whose every key is a root, so list data and tree data share one code path.
// Type-only, so the cycle back into `15_selection.ts` is erased at compile time.
import type { GridSelection } from "./15_selection.js"

// --- Identity --------------------------------------------------------------

/** Stable across data refresh. Selection, expansion, sizing, and pinning are keyed by it. */
export type RowId = string
/** Unique within one column schema. */
export type ColId = string
/** `row + NUL + col`. NUL because ids are user strings and may contain anything else. */
export type CellId = string

export const CELL_SEP = String.fromCharCode(0)
export const cellId = (row: RowId, col: ColId): CellId => row + CELL_SEP + col
export const cellParts = (id: CellId): readonly [RowId, ColId] => {
  const at = id.indexOf(CELL_SEP)
  return at === -1 ? [id, ""] : [id.slice(0, at), id.slice(at + 1)]
}

/** Synthesized group rows live in their own namespace so they can never collide with a RowId. */
export const GROUP_PREFIX = "g:"
export const isGroupKey = (key: string): boolean => key.startsWith(GROUP_PREFIX)

// --- The container: an ordered forest ---------------------------------------

/**
 * An ordered forest of keyed items. `roots` and each `children` entry carry sibling order;
 * `parent` is the inverse edge, stored rather than derived so ancestor walks are O(depth).
 *
 * A flat relation is the degenerate case: `children` empty, every key in `roots`.
 * Both grid axes use this. Column header groups are a column-axis forest; tree data and row
 * grouping are row-axis forests.
 */
export interface Axis<K extends string, T> {
  readonly roots: readonly K[]
  readonly children: ReadonlyMap<K, readonly K[]>
  readonly parent: ReadonlyMap<K, K>
  readonly by: ReadonlyMap<K, T>
}

/** One node of the flattened, visible result. `index` is its position in the flat list. */
export interface FlatNode<K extends string> {
  readonly key: K
  readonly depth: number
  readonly index: number
  readonly parent: K | null
  /** True when the node has children, open or not. Drives the expander glyph. */
  readonly hasChildren: boolean
}

/** Half-open `[start, end)` over a flat list. Pagination and virtualization both produce one. */
export interface IndexRange {
  readonly start: number
  readonly end: number
}

/** Pinning splits a flat list into three ordered runs rendered in three sticky containers. */
export type Side = "start" | "center" | "end"
export interface Partitioned<K extends string> {
  readonly start: readonly K[]
  readonly center: readonly K[]
  readonly end: readonly K[]
}

/**
 * How a predicate propagates through a forest.
 * `prune`      keep a node only when it and every ancestor match. What a flat grid wants.
 * `ancestors`  keep a node when it matches, plus every ancestor of a match, so a matching leaf
 *              stays reachable. MUI tree-data default.
 * `subtree`    keep a node when it matches, plus its whole subtree.
 */
export type FilterMode = "prune" | "ancestors" | "subtree"

// --- Filter model -----------------------------------------------------------

export type LogicOperator = "and" | "or"

/** One row of the filter panel. `value` is undefined for unary operators (isEmpty, isNotEmpty). */
export type FilterItem = {
  readonly id: string
  readonly field: ColId
  readonly operator: string
  readonly value?: unknown
}

export type FilterModel = {
  readonly items: readonly FilterItem[]
  readonly logic: LogicOperator
  /** Quick filter: whitespace-split terms, each matched against every filterable column. */
  readonly quick: readonly string[]
  readonly quickLogic: LogicOperator
}

/**
 * Compiles one filter item into a value predicate, or returns null when the item is incomplete
 * (empty value on a binary operator), which means the item does not filter.
 */
export interface FilterOperator<V = unknown> {
  readonly name: string
  /** Unary operators take no value and are never incomplete. */
  readonly unary?: boolean
  readonly build: (item: FilterItem) => ((value: V) => boolean) | null
}

// --- Sort model -------------------------------------------------------------

export type SortDirection = "asc" | "desc"
export interface SortItem {
  readonly field: ColId
  readonly sort: SortDirection
}
export type SortModel = readonly SortItem[]

// --- Slots -----------------------------------------------------------------

/**
 * Anything a slot may hand back. React elements match structurally through `$$typeof`, so this
 * package never imports React and a DOM-only consumer never pulls it in.
 */
export type Renderable =
  | Node
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly Renderable[]
  | { readonly $$typeof: symbol }

/**
 * A slot returns a renderable, or a signal of one. Returning a signal is how a single cell gets
 * live content without the grid minting a signal per cell: the writer subscribes that one node,
 * and the row around it never re-renders.
 *
 * There are no value/onChange pairs anywhere in this package. A signal is both halves already.
 */
export type Slot<Ctx> = (ctx: Ctx) => Renderable | { readonly $: unknown }

export interface CellCtx<TRow> {
  readonly row: RowId
  readonly col: ColId
  readonly data: TRow
  readonly value: unknown
  readonly node: FlatNode<RowId>
  readonly editing: boolean
}
export interface HeaderCtx {
  readonly col: ColId
  readonly node: FlatNode<ColId>
  readonly sort: SortDirection | null
  readonly pinned: Side | undefined
}
export interface RowCtx<TRow> {
  readonly row: RowId
  readonly data: TRow
  readonly node: FlatNode<RowId>
  readonly selected: boolean
  readonly open: boolean
}

/** Every replaceable piece. Absent means the built-in is used. @feature-declared view.slots */
export interface Slots<TRow> {
  readonly cell?: Slot<CellCtx<TRow>>
  readonly editor?: Slot<CellCtx<TRow>>
  readonly header?: Slot<HeaderCtx>
  readonly headerGroup?: Slot<HeaderCtx>
  readonly row?: Slot<RowCtx<TRow>>
  readonly detail?: Slot<RowCtx<TRow>>
  readonly expander?: Slot<RowCtx<TRow>>
  readonly checkbox?: Slot<RowCtx<TRow>>
  readonly resizeHandle?: Slot<HeaderCtx>
  readonly dragPreview?: Slot<HeaderCtx | RowCtx<TRow>>
  readonly empty?: Slot<Record<string, never>>
  readonly loading?: Slot<Record<string, never>>
  readonly footer?: Slot<Record<string, never>>
}

// --- Column schema ----------------------------------------------------------

export type ColumnType =
  | "string" | "number" | "boolean" | "date" | "dateTime" | "singleSelect" | "actions" | "custom"

export interface FormulaApi<TRow> {
  readonly get: (row: TRow, field: ColId) => unknown
}

export interface ColumnDef<TRow, V = unknown> {
  readonly id: ColId
  readonly header?: string
  readonly type?: ColumnType
  /** Reads the raw value. Defaults to `row[id]`. */
  readonly value?: (row: TRow) => V
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
  readonly editable?: boolean
  readonly pinnable?: boolean
  /** Header group membership: this column's parent key in the column axis. @feature-declared col.group */
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
  /** Per-column body slot. Beats `Slots.cell`, which stays the schema-wide default. */
  readonly cell?: Slot<CellCtx<TRow>>
  /** Per-column header slot. `header` above is the plain-text label. */
  readonly headerCell?: Slot<HeaderCtx>
  /** Default pin side, seeding `colPinning`. State still wins, so a drag can unpin it. */
  readonly pin?: Side
}

// --- State: everything the URL round-trips ----------------------------------

/**
 * Paging is one operator with three retention rules, rather than three features.
 *
 * `all`       every loaded row is a candidate. No window from paging at all.
 * `pages`     one page at a time. `index` moves, earlier pages are dropped.
 * `infinite`  pages accumulate. `index` is the highest page fetched, and the window is
 *             `[0, (index + 1) * size)`. Scrolling near the end raises `index` by one.
 *
 * Client mode applies the window itself. Server mode publishes it and expects `rows` to already
 * satisfy it, which is why `infinite` needs the caller to append rather than replace.
 */
export type PageMode = "all" | "pages" | "infinite"

/**
 * Which axis feeds the vertical pipeline: the one that scrolls, pages, and pins into sticky runs.
 * `"columns"` is the transpose, the matrix layout whose first column holds what are normally
 * column headers. The seating chart that reads this lives in `12_transpose.ts` and nowhere else.
 */
export type Orientation = "rows" | "columns"

export type Page = {
  readonly mode: PageMode
  readonly index: number
  readonly size: number
  /** Server mode only: total rows behind the query, so the scrollbar can measure the whole result. */
  readonly total: number | null
}

/**
 * Emitted when an infinite page boundary is crossed. The caller fetches and appends; nothing in
 * the kernel waits on it, so a slow fetch never blocks scrolling through loaded rows.
 */
export type PageRequest = {
  readonly index: number
  readonly size: number
}

/** @feature-declared cell.select */
export type RangeSelection = {
  readonly anchor: CellId | null
  readonly head: CellId | null
}

/**
 * Declared as a type alias rather than an interface on purpose: `Signal<T>`'s recursive proxy
 * map gates on `T extends Record<string, unknown>`, and an interface has no implicit index
 * signature, so `state.sort.$()` would not typecheck against an interface.
 */
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
  /** Off renders every visible row. The kernel is identical either way. */
  readonly virtualize: boolean
}

/**
 * client: the kernel runs filter, sort, group, and pagination over every row it holds.
 * server: the kernel skips those stages, publishes a `QueryDescriptor` for the caller to send
 * upstream, and treats `rows` as the already-resolved page. Everything else, tree flattening,
 * pinning, virtualization, selection, is identical in both modes.
 */
export type GridMode = "client" | "server"

/** What a server mode caller must satisfy. Serialized by the caller, never by the grid. */
/** @feature-declared page.server */
export type QueryDescriptor = {
  readonly sort: SortModel
  readonly group: readonly ColId[]
  readonly page: Page
  /** Set only when a tree node is being expanded and its children are not loaded yet. */
  readonly expand: RowId | null
}

export type Viewport = {
  readonly top: number
  readonly left: number
  readonly height: number
  readonly width: number
}

// --- Action grammar: intent -> change -> effect -----------------------------

export type Modifiers = {
  readonly alt: boolean
  readonly ctrl: boolean
  readonly meta: boolean
  readonly shift: boolean
  readonly button: number
}

/** The DOM saw something. No state has moved. Every entry comes from an xdom path template. */
export type GridIntent =
  | { phase: "intent"; type: "cell.click"; row: RowId; col: ColId; mods: Modifiers }
  | { phase: "intent"; type: "cell.dblclick"; row: RowId; col: ColId; mods: Modifiers }
  | { phase: "intent"; type: "cell.pointerdown"; row: RowId; col: ColId; mods: Modifiers }
  | { phase: "intent"; type: "cell.pointerenter"; row: RowId; col: ColId }
  | { phase: "intent"; type: "cell.contextmenu"; row: RowId; col: ColId; x: number; y: number; mods: Modifiers }
  | { phase: "intent"; type: "header.click"; col: ColId; mods: Modifiers }
  | { phase: "intent"; type: "header.pointerdown"; col: ColId; part: "move" | "resize" | "select"; x: number; width: number; mods: Modifiers }
  | { phase: "intent"; type: "header.contextmenu"; col: ColId; x: number; y: number; mods: Modifiers }
  | { phase: "intent"; type: "row.pointerdown"; row: RowId; part: "handle"; y: number }
  | { phase: "intent"; type: "row.contextmenu"; row: RowId; x: number; y: number; mods: Modifiers }
  | { phase: "intent"; type: "row.hover"; row: RowId | null }
  | { phase: "intent"; type: "expander.click"; row: RowId; mods: Modifiers }
  | { phase: "intent"; type: "checkbox.click"; row: RowId; mods: Modifiers }
  | { phase: "intent"; type: "key"; key: string; mods: Modifiers }
  | { phase: "intent"; type: "viewport.scroll"; top: number; left: number }
  | { phase: "intent"; type: "viewport.resize"; width: number; height: number }

/** One key of GridState was written. Reduced synchronously, never asynchronously. */
export type GridChange = {
  [K in keyof GridState]: { phase: "change"; type: K } & { readonly [P in K]: GridState[P] }
}[keyof GridState]

/** Leaves the grid. The consumer decides what an activate or an edit commit means. */
export type GridEffect<TRow> =
  | { phase: "effect"; type: "activate"; row: RowId; col: ColId; value: TRow }
  | { phase: "effect"; type: "editCommit"; row: RowId; col: ColId; value: unknown }
  | { phase: "effect"; type: "editCancel"; row: RowId; col: ColId }
  | { phase: "effect"; type: "reorderRow"; row: RowId; before: RowId | null }
  | { phase: "effect"; type: "copy"; text: string }
  | { phase: "effect"; type: "paste"; text: string; row: RowId; col: ColId }
  | { phase: "effect"; type: "custom"; name: string; payload: unknown }

export type GridAction<TRow> = GridIntent | GridChange | GridEffect<TRow>
export type GridPhase = GridAction<never>["phase"]
