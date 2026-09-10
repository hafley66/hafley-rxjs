// @comment-ok: the two consumer wirings are the deliverable of this module and have no runtime home
// A detail row is a real node in the row axis, model (a). `renderPlan` windows a key list and sizes
// it through a `Sizer` built over that same list, so one index space is the only way the scroll
// spacer, the window, and the rendered runs can agree. Model (b) would leave the sizer inventing
// pixels at row boundaries it cannot see, and a tall panel drifts the scroll on every open.
// The cost is a synthetic key, which `GROUP_PREFIX` already pays for group rows.
//
// The panel is a sibling inserted after its row, not a child, so it is visible exactly when its row
// is visible. As a child it would need the row's tree expansion to be open, which would tie the
// panel to a flag it has nothing to do with.
//
// Opening a detail from a cell click, opt-in:
//
//   const orders = grid<Row>({ ..., epics: [...defaultEpics<Row>(), detailOnCellClick({ columns: ["__detail"] })] })
//   const withPanels = Signal(() => withDetail(g.view.sorted.$(), g.state.detail.$(), (row) => g.view.sorted.$().by.get(row)))
//
// The same click driving lazy tree loading instead, no epic at all:
//
//   const source = Signal<readonly Row[]>(ROWS)
//   g.intent$.pipe(
//     filter((it) => it.type === "cell.click" && it.col === "name"),
//     filter((it) => loaded.has(it.row) === false),
//     mergeMap((it) => fetchChildren(it.row).then((kids) => ({ row: it.row, kids }))),
//   ).subscribe(({ row, kids }) => {
//     loaded.add(row)
//     source.$(attach(source.$(), row, kids))
//     orders.dispatch({ phase: "change", type: "expanded", expanded: { ...g.state.expanded.$(), [row]: true } })
//   })
import { filter, map, type Observable } from "rxjs"
import type { Signal as Sig } from "@hafley66/signals"
import { CELL_SEP } from "./0_types.js"
import type { Axis, ColId, GridAction, GridIntent, GridState, RowId } from "./0_types.js"
import type { GridEpicCtx } from "./7_epics.js"

// --- Keys -------------------------------------------------------------------

export type DetailKey = string

// NUL rather than a readable prefix: a RowId is a user string and may well start with `d:`, while
// NUL is already reserved by `CellId`, so this namespace cannot be reached from real data.
export const DETAIL_PREFIX: string = CELL_SEP + "d:"

export const isDetailKey = (key: string): boolean => key.startsWith(DETAIL_PREFIX)

export const detailKeyFor = (row: RowId): DetailKey => DETAIL_PREFIX + row

/** Not a detail key means the caller already holds the row, so it answers itself. */
export const rowOfDetailKey = (key: DetailKey): RowId =>
  isDetailKey(key) ? key.slice(DETAIL_PREFIX.length) : key

// --- State ------------------------------------------------------------------

/** Which cell opened the panel. `true` is a panel opened by something other than a cell. */
export type DetailOpen = Readonly<Record<RowId, ColId | true>>

export type DetailState = { readonly detail: DetailOpen }

// The intersection is what lets this module compile before `GridState` carries `detail`. Once the
// schema patch lands the two collapse into one type and nothing here changes.
export type GridStateWithDetail = GridState & DetailState

export type DetailChange = { phase: "change"; type: "detail"; detail: DetailOpen }

type HasDetail = { readonly detail: DetailOpen }

/** Recording the column, not just a flag, is what lets a second cell swap the panel's contents. */
export function openDetail(
  state: HasDetail,
  row: RowId,
  col: ColId,
): Partial<GridStateWithDetail> {
  return { detail: { ...state.detail, [row]: col } }
}

export function closeDetail(state: HasDetail, row: RowId): Partial<GridStateWithDetail> {
  const detail: Record<RowId, ColId | true> = { ...state.detail }
  // Deleted rather than set false, so `Object.keys` is the open set and `withDetail` needs no filter.
  delete detail[row]
  return { detail }
}

// A click on the cell that opened the panel closes it; a click on any other cell in the same row
// swaps the panel to that cell, because closing what the user is pointing at reads as a lost click.
export function toggleDetail(
  state: HasDetail,
  row: RowId,
  col: ColId,
): Partial<GridStateWithDetail> {
  return state.detail[row] === col ? closeDetail(state, row) : openDetail(state, row, col)
}

// --- The axis operator ------------------------------------------------------

/** One node per open row, inserted right after it in its sibling list. @feature row.detail */
export function withDetail<K extends string, T>(
  axis: Axis<K, T>,
  open: DetailOpen,
  make: (row: RowId) => T | undefined,
): Axis<K, T> {
  const panels = new Map<K, T>()
  for (const row of Object.keys(open)) {
    if (open[row] === undefined) continue
    const key = row as K
    // A row not in the axis was filtered out or reloaded away, and an already inserted key means
    // the operator ran twice, so both are skipped and `withDetail` is idempotent.
    if (!axis.by.has(key) || axis.by.has(detailKeyFor(row) as K)) continue
    const value = make(row)
    // `undefined` is how a caller declines a panel, so the axis never carries a valueless node.
    if (value === undefined) continue
    panels.set(key, value)
  }
  // Identity by reference, the convention every operator in `1_axis.ts` follows.
  if (panels.size === 0) return axis
  const rows = panels
  const insert = (list: readonly K[]): readonly K[] => {
    const out: K[] = []
    let touched = false
    for (const key of list) {
      out.push(key)
      if (!rows.has(key)) continue
      out.push(detailKeyFor(key) as K)
      touched = true
    }
    return touched ? out : list
  }
  const by = new Map(axis.by)
  const parent = new Map(axis.parent)
  const children = new Map(axis.children)
  for (const [key, value] of panels) {
    const detail = detailKeyFor(key) as K
    by.set(detail, value)
    const up = axis.parent.get(key)
    if (up !== undefined) parent.set(detail, up)
  }
  for (const [key, kids] of axis.children) {
    const next = insert(kids)
    if (next !== kids) children.set(key, next)
  }
  return { roots: insert(axis.roots), children, parent, by }
}

// A panel is tall and variable, so its key needs a height in `rowHeight` or the sizer measures it
// at the density default and the scroll position drifts by the difference on every open.
export function detailHeights(
  open: DetailOpen,
  height: number,
  base: Readonly<Record<RowId, number>> = {},
): Readonly<Record<RowId, number>> {
  const out: Record<RowId, number> = { ...base }
  for (const row of Object.keys(open)) {
    if (open[row] === undefined) continue
    out[detailKeyFor(row)] = height
  }
  return out
}

// --- The epic ---------------------------------------------------------------

export interface DetailEpicOptions {
  /** Absent means every column opens the panel, which is the whole-row disclosure case. */
  readonly columns?: readonly ColId[]
  /** `swap` never closes, for a panel that is a preview pane rather than a disclosure. */
  readonly mode?: "toggle" | "swap"
}

// Typed against the intersection rather than `GridEpic<TRow>` for the same reason as
// `GridStateWithDetail`: after the schema patch the two signatures are the same signature.
export type DetailEpic<TRow> = (
  actions$: Observable<GridAction<TRow>>,
  state: Sig<GridStateWithDetail>,
  ctx: GridEpicCtx<TRow>,
) => Observable<DetailChange>

/** Opt-in, so a plain grid still reduces a cell click to nothing but `activate`. @feature row.detail */
export function detailOnCellClick<TRow>(opts: DetailEpicOptions = {}): DetailEpic<TRow> {
  const cols = opts.columns === undefined ? null : new Set(opts.columns)
  const swap = opts.mode === "swap"
  return (actions$, state) =>
    actions$.pipe(
      filter((it): it is Extract<GridIntent, { type: "cell.click" }> =>
        it.phase === "intent" && it.type === "cell.click",
      ),
      filter((it) => cols === null || cols.has(it.col)),
      map((it): DetailChange => {
        const current = { detail: state.detail.$() }
        const next = swap ? openDetail(current, it.row, it.col) : toggleDetail(current, it.row, it.col)
        return { phase: "change", type: "detail", detail: next.detail ?? current.detail }
      }),
    )
}
