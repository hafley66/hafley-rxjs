// Two rules hold for every factory here, enforced in code: a built-in is never `groupable`, and it
// never carries `flex` (min and max are pinned to width, so the pool cannot reopen).
import { Signal } from "@hafley66/signals"
import type { Signal as Sig } from "@hafley66/signals"
import { isGroupKey } from "./0_types.js"
import type { CellCtx, ColId, ColumnDef, HeaderCtx, RowId, Side, Slot } from "./0_types.js"
import { isDetailKey } from "./11_detail.js"
import { checkAttrs, expandAttrs, moveAttrs, SG_DEPTH } from "./3_paths.js"
import type { Grid } from "./8_grid.js"

// --- Identity ---------------------------------------------------------------

export type BuiltInId = "check" | "radio" | "expand" | "drag" | "detail" | "rowNumber"

/** Default ids, one namespace so a data column called `check` still keeps its own seat. */
export const BUILT_IN_IDS: Readonly<Record<BuiltInId, ColId>> = Object.freeze({
  check: "__check",
  radio: "__radio",
  expand: "__expand",
  drag: "__drag",
  detail: "__detail",
  rowNumber: "__rowNumber",
})

const BUILT_IN_ID_SET: ReadonlySet<ColId> = new Set(Object.values(BUILT_IN_IDS))

// The two required slots are why the interface exists: a built-in always carries both, a plain
// `ColumnDef` leaves them optional.
export interface BuiltInColumnDef<TRow> extends ColumnDef<TRow> {
  readonly builtIn: BuiltInId
  readonly cell: Slot<CellCtx<TRow>>
  readonly headerCell: Slot<HeaderCtx>
}

/** By the discriminator first, because `opts.id` may rename any of them. */
export const isBuiltIn = <TRow>(col: ColumnDef<TRow>): col is BuiltInColumnDef<TRow> =>
  typeof (col as { builtIn?: unknown }).builtIn === "string" || BUILT_IN_ID_SET.has(col.id)

/** What sorting, grouping, and the flex pool should be looking at. */
export const dataColumns = <TRow>(
  columns: readonly ColumnDef<TRow>[],
): readonly ColumnDef<TRow>[] => columns.filter((it) => !isBuiltIn(it))

// Pinning is state, and state has no idea which columns are glyph boxes that must not scroll away,
// so the default side travels on the def and this produces the seed for `colPinning`.
export function pinningFor<TRow>(
  columns: readonly ColumnDef<TRow>[],
): Readonly<Record<ColId, Side>> {
  const out: Record<ColId, Side> = {}
  for (const col of columns) {
    if (!isBuiltIn(col)) continue
    const side = col.pin
    if (side !== undefined) out[col.id] = side
  }
  return out
}

// The `checkbox.click` intent carries no column, so the schema is the only place the two selection
// columns can be told apart, and reading it here keeps one epic serving both.
export const rowSelectionMode = <TRow>(columns: readonly ColumnDef<TRow>[]): "single" | "multi" =>
  columns.some((it) => isBuiltIn(it) && it.builtIn === "radio") ? "single" : "multi"

// --- Tri-state select-all toggle --------------------------------------------

export type SelectAllState = "none" | "some" | "all"

/** An empty list is `none`: nothing is selected, and there is nothing to select. */
export function selectAllState(
  rows: readonly RowId[],
  selection: Readonly<Record<RowId, boolean>>,
): SelectAllState {
  let on = 0
  for (const row of rows) if (selection[row] === true) on++
  if (on === 0) return "none"
  return on === rows.length ? "all" : "some"
}

/** All means clear, anything else means fill. A row outside `rows` keeps whatever flag it had. */
export function toggleSelectAll(
  rows: readonly RowId[],
  selection: Readonly<Record<RowId, boolean>>,
): Readonly<Record<RowId, boolean>> {
  const next: Record<RowId, boolean> = { ...selection }
  const fill = selectAllState(rows, selection) !== "all"
  for (const row of rows) next[row] = fill
  return next
}

const SELECT_ALL_GLYPH: Readonly<Record<SelectAllState, string>> = Object.freeze({
  none: "☐",
  some: "☑",
  all: "☒",
})

// --- Options ----------------------------------------------------------------

export interface BuiltInColumnOptions<TRow> {
  readonly id?: ColId
  readonly width?: number
  /** Default pin side. Read by `pinningFor`, never by the kernel. */
  readonly pin?: Side
  readonly header?: Slot<HeaderCtx>
  readonly cell?: Slot<CellCtx<TRow>>
}

export interface SelectColumnOptions<TRow> extends BuiltInColumnOptions<TRow> {
  // Deferred because a schema is built before `grid()` is called and the select-all toggle is the one
  // slot that reads the grid back: `() => g` closes over the binding rather than the value.
  readonly grid?: () => Grid<TRow> | undefined
}

export interface RowNumberColumnOptions<TRow> extends BuiltInColumnOptions<TRow> {
  /** The ordinal of the first row. One, because a grid is read by people. */
  readonly start?: number
  // Added to `FlatNode.index`. Client mode holds every row, so the flat index is already absolute;
  // server mode holds one page, so the offset is that page's origin.
  readonly offset?: () => number
  readonly grid?: () => Grid<TRow> | undefined
}

// --- Element helpers --------------------------------------------------------

// `document` is touched only inside a slot call, so this module imports clean into a node test.
const el = (
  tag: string,
  className: string,
  attrs: Readonly<Record<string, string>> = {},
): HTMLElement => {
  const node = document.createElement(tag)
  node.className = className
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value)
  return node
}

const EMPTY_HEADER: Slot<HeaderCtx> = () => ""

const GLYPH_WIDTH = 36
const NUMBER_WIDTH = 56

function builtInColumn<TRow>(
  builtIn: BuiltInId,
  width: number,
  side: Side | undefined,
  header: Slot<HeaderCtx>,
  cell: Slot<CellCtx<TRow>>,
  opts: BuiltInColumnOptions<TRow>,
): BuiltInColumnDef<TRow> {
  const resolvedWidth = opts.width ?? width
  return {
    id: opts.id ?? BUILT_IN_IDS[builtIn],
    builtIn,
    header: "",
    type: builtIn === "rowNumber" ? "number" : "actions",
    width: resolvedWidth,
    // Rule 2: bounded both sides, so neither `flex` nor a resize drag can grow the glyph box.
    minWidth: resolvedWidth,
    maxWidth: resolvedWidth,
    pin: opts.pin ?? side,
    sortable: false,
    filterable: false,
    // Rule 1.
    groupable: false,
    resizable: false,
    editable: false,
    pinnable: true,
    headerCell: opts.header ?? header,
    cell: opts.cell ?? cell,
  }
}

// --- Selection --------------------------------------------------------------

// A glyph carrying its own text would be a frame stale on every click, because a cell rebuilds only
// when its data, column run, or editing flag changed. CSS reads `data-selected` off the row box.
const selectGlyph = <TRow>(kind: "check" | "radio"): Slot<CellCtx<TRow>> =>
  () => el("span", `sg-check sg-check-${kind}`, { ...checkAttrs(), "data-check": kind })

/** Multi-select. The header is a signal, so a selection click repaints one node. @feature row.select */
export function checkboxColumn<TRow>(opts: SelectColumnOptions<TRow> = {}): BuiltInColumnDef<TRow> {
  const read = opts.grid
  const header: Slot<HeaderCtx> = () => {
    if (read === undefined) return SELECT_ALL_GLYPH.none
    const glyph: Sig<string> = Signal<string>(() => {
      const grid = read()
      if (grid === undefined) return SELECT_ALL_GLYPH.none
      // A group header and a detail panel are not selectable rows, so counting them would leave
      // the select-all toggle stuck on `some` for a grid whose every real row is checked.
      const rows = grid.view.flat
        .$()
        .map((it) => it.key)
        .filter((it) => !isGroupKey(it) && !isDetailKey(it))
      return SELECT_ALL_GLYPH[selectAllState(rows, grid.state.rowSelection.$())]
    })
    return glyph
  }
  return builtInColumn<TRow>("check", GLYPH_WIDTH, "start", header, selectGlyph<TRow>("check"), opts)
}

/** Single select, same box and route as the checkbox column. @feature row.select */
export function radioColumn<TRow>(opts: BuiltInColumnOptions<TRow> = {}): BuiltInColumnDef<TRow> {
  // No select-all toggle: selecting every row at once is the one thing single select cannot mean.
  return builtInColumn<TRow>(
    "radio",
    GLYPH_WIDTH,
    "start",
    EMPTY_HEADER,
    selectGlyph<TRow>("radio"),
    opts,
  )
}

// --- Tree expander ----------------------------------------------------------

/** The expander as a column, so a caller can place or pin it. @feature row.expand */
// Indent reads `--sg-depth` with `FlatNode.depth` as the fallback: the row property is rewritten
// every pass, so a depth baked into the cell survives a re-parent it should not.
export function expandColumn<TRow>(opts: BuiltInColumnOptions<TRow> = {}): BuiltInColumnDef<TRow> {
  const cell: Slot<CellCtx<TRow>> = (ctx) => {
    const host = el("span", "sg-expander sg-cell-expander", expandAttrs())
    host.setAttribute("data-leaf", String(!ctx.node.hasChildren))
    host.style.setProperty(
      "margin-inline-start",
      `calc(var(${SG_DEPTH}, ${ctx.node.depth}) * var(--sg-indent, 16px))`,
    )
    return host
  }
  return builtInColumn<TRow>("expand", GLYPH_WIDTH, "start", EMPTY_HEADER, cell, opts)
}

// --- Row drag ---------------------------------------------------------------

/** `moveAttrs()` is shared with the header handle; the ancestor chain tells them apart. @feature row.order */
export function dragColumn<TRow>(opts: BuiltInColumnOptions<TRow> = {}): BuiltInColumnDef<TRow> {
  const cell: Slot<CellCtx<TRow>> = () => {
    const host = el("span", "sg-drag", moveAttrs())
    host.append("∷")
    return host
  }
  return builtInColumn<TRow>("drag", GLYPH_WIDTH, "start", EMPTY_HEADER, cell, opts)
}

// --- Detail disclosure ------------------------------------------------------

/** The disclosure that opens the detail area for its row. @feature row.detail */
// No route of its own: a click here is already a `cell.click` carrying this column's id, which is
// what `detailOnCellClick` filters on and what a consumer pipes for tree loading instead.
export function detailColumn<TRow>(opts: BuiltInColumnOptions<TRow> = {}): BuiltInColumnDef<TRow> {
  const cell: Slot<CellCtx<TRow>> = () => {
    const host = el("span", "sg-detail-toggle")
    host.append("▸")
    return host
  }
  return builtInColumn<TRow>("detail", GLYPH_WIDTH, "start", EMPTY_HEADER, cell, opts)
}

// --- Ordinal ----------------------------------------------------------------

/** The row's ordinal. */
// Client mode paginates the key list downstream of the flat walk, so `FlatNode.index` is already
// absolute there and the offset stays zero.
export function rowNumberColumn<TRow>(
  opts: RowNumberColumnOptions<TRow> = {},
): BuiltInColumnDef<TRow> {
  const start = opts.start ?? 1
  const read = opts.grid
  const offset =
    opts.offset ??
    (() => {
      const grid = read?.()
      if (grid === undefined || grid.mode !== "server") return 0
      const page = grid.state.page.$()
      return page.mode === "all" ? 0 : page.index * page.size
    })
  const cell: Slot<CellCtx<TRow>> = (ctx) => String(ctx.node.index + start + offset())
  return builtInColumn<TRow>("rowNumber", NUMBER_WIDTH, "start", EMPTY_HEADER, cell, opts)
}
