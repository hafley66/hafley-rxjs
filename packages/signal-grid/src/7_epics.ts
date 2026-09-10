// Where an intent becomes a change or an effect. Nothing here touches the DOM and nothing here is
// async: an epic reads the state signal, reads the derived view, and returns the next action.
import { filter, map, merge, Observable } from "rxjs"
import type { Epic, Signal as Sig } from "@hafley66/signals"
import { descendantsOf } from "./1_axis.js"
import { isBuiltIn, rowSelectionMode, type BuiltInId } from "./5_columns.js"
import { drag, landingIndex, type DragStreams } from "./6_gestures.js"
import { neutralCell } from "./12_transpose.js"
import {
  beginAt,
  clearSelection,
  columnAnchor,
  commitBlock,
  extendTo,
  isRangeEmpty,
  rangeOf,
  type GridSelection,
  type SelectionMode,
} from "./15_selection.js"
import {
  cellId,
  cellParts,
  type CellId,
  type ColId,
  type ColumnDef,
  type GridAction,
  type GridIntent,
  type GridState,
  type Modifiers,
  type RowId,
  type SortDirection,
  type SortModel,
  type Viewport,
} from "./0_types.js"
import type { GridView } from "./8_grid.js"

/** What an epic is allowed to read besides state: the derived view and the schema behind it. */
export interface GridEpicCtx<TRow> {
  readonly view: GridView<TRow>
  readonly columns: Sig<readonly ColumnDef<TRow>[]>
  readonly viewport: Sig<Viewport>
  /** Pixels of one row. Density lives in `grid()`, so the resolved height is handed down. */
  readonly rowHeight: (row: RowId) => number
  readonly overscan: number
}

export type GridEpic<TRow> = Epic<GridAction<TRow>, GridState, GridEpicCtx<TRow>>

type Intent<T extends GridIntent["type"]> = Extract<GridIntent, { type: T }>

// Keyed by the intent type so a renamed member of `GridIntent` breaks the epic that reads it,
// rather than leaving it subscribed to a type nothing dispatches.
const intents = <TRow, T extends GridIntent["type"]>(
  actions$: Observable<GridAction<TRow>>,
  type: T,
): Observable<Intent<T>> =>
  actions$.pipe(filter((it): it is Intent<T> => it.phase === "intent" && it.type === type))

const emitted = <TRow>() =>
  filter((action: GridAction<TRow> | null): action is GridAction<TRow> => action !== null)

/** A plain click: no chord, primary button. Anything else belongs to another gesture. */
export const isPlainClick = (mods: Modifiers): boolean =>
  !mods.alt && !mods.ctrl && !mods.meta && !mods.shift && mods.button === 0

const clamp = (value: number, low: number, high: number): number =>
  value < low ? low : value > high ? high : value

const defOf = <TRow>(ctx: GridEpicCtx<TRow>, col: ColId): ColumnDef<TRow> | undefined =>
  ctx.columns.$().find((it) => it.id === col)

/** Visible leaves in current order. Header group nodes carry no def, so they are not draggable. */
const colOrderOf = <TRow>(ctx: GridEpicCtx<TRow>): readonly ColId[] => {
  const defs = new Set(ctx.columns.$().map((it) => it.id))
  return ctx.view.cols.$().map((it) => it.key).filter((key) => defs.has(key))
}

// --- Sort -------------------------------------------------------------------

// asc, desc, off. Off removes the column instead of storing a third direction, so the model never
// carries an item that sorts by nothing.
const cycle = (model: SortModel, col: ColId, shift: boolean): SortModel => {
  const current = model.find((it) => it.field === col)
  const next: SortDirection | null =
    current === undefined ? "asc" : current.sort === "asc" ? "desc" : null
  if (!shift) return next === null ? [] : [{ field: col, sort: next }]
  if (next === null) return model.filter((it) => it.field !== col)
  if (current === undefined) return [...model, { field: col, sort: next }]
  // Replaced in place, so a shift-click that flips a direction does not also promote the column
  // to the end of the sort order.
  return model.map((it) => (it.field === col ? { field: col, sort: next } : it))
}

export function sortOnHeaderClick<TRow>(): GridEpic<TRow> {
  return (actions$, state, ctx) =>
    intents<TRow, "header.click">(actions$, "header.click").pipe(
      map((it): GridAction<TRow> | null => {
        if (defOf(ctx, it.col)?.sortable === false) return null
        return { phase: "change", type: "sort", sort: cycle(state.sort.$(), it.col, it.mods.shift) }
      }),
      emitted<TRow>(),
    )
}

// --- Expand -----------------------------------------------------------------

export function expandOnExpanderClick<TRow>(): GridEpic<TRow> {
  return (actions$, state, ctx) =>
    intents<TRow, "expander.click">(actions$, "expander.click").pipe(
      map((it): GridAction<TRow> => {
        const open = state.expanded.$()
        const next = open[it.row] !== true
        const expanded: Record<RowId, boolean> = { ...open, [it.row]: next }
        // Alt is the whole-branch modifier every file tree has, and the only reader of
        // `descendantsOf`.
        if (it.mods.alt) {
          for (const key of descendantsOf(ctx.view.sorted.$(), it.row)) expanded[key] = next
        }
        return { phase: "change", type: "expanded", expanded }
      }),
    )
}

// --- Select -----------------------------------------------------------------

export function selectRowsOnCheckboxClick<TRow>(): GridEpic<TRow> {
  return (actions$, state, ctx) => {
    // The range anchor is gesture state, not grid state: it is not in the URL, and a reload has no
    // last click to remember.
    let anchor: RowId | null = null
    return intents<TRow, "checkbox.click">(actions$, "checkbox.click").pipe(
      map((intent): GridAction<TRow> => {
        const current = state.rowSelection.$()
        const order = ctx.view.flat.$().map((it) => it.key)
        const from = anchor === null ? -1 : order.indexOf(anchor)
        const to = order.indexOf(intent.row)
        if (intent.mods.shift && from !== -1 && to !== -1) {
          const rowSelection: Record<RowId, boolean> = { ...current }
          for (let index = Math.min(from, to); index <= Math.max(from, to); index++) {
            const key = order[index]
            if (key !== undefined) rowSelection[key] = true
          }
          return { phase: "change", type: "rowSelection", rowSelection }
        }
        anchor = intent.row
        // A radio column means one row, not one more row, so single select replaces the map
        // rather than extending it. Read from the schema because the intent carries no column.
        if (rowSelectionMode(ctx.columns.$()) === "single") {
          return { phase: "change", type: "rowSelection", rowSelection: { [intent.row]: true } }
        }
        const rowSelection = { ...current, [intent.row]: current[intent.row] !== true }
        return { phase: "change", type: "rowSelection", rowSelection }
      }),
    )
  }
}

// --- Activate ---------------------------------------------------------------

/** The only way a consumer hears "the user picked this row". Modified clicks belong elsewhere. */
export function activateOnCellClick<TRow>(): GridEpic<TRow> {
  return (actions$, _state, ctx) =>
    intents<TRow, "cell.click">(actions$, "cell.click").pipe(
      filter((it) => isPlainClick(it.mods)),
      map((it): GridAction<TRow> | null => {
        const value = ctx.view.sorted.$().by.get(it.row)
        return value === undefined
          ? null
          : { phase: "effect", type: "activate", row: it.row, col: it.col, value }
      }),
      emitted<TRow>(),
    )
}

// --- Resize -----------------------------------------------------------------

interface ResizeStart {
  readonly col: ColId
  readonly x: number
  readonly width: number
  readonly min: number
  readonly max: number
}

const DEFAULT_COL_WIDTH = 100

export function resizeOnHeaderDrag<TRow>(streams?: DragStreams): GridEpic<TRow> {
  return (actions$, state, ctx) => {
    const widthAt = (start: ResizeStart, x: number): GridAction<TRow> => ({
      phase: "change",
      type: "colWidth",
      colWidth: {
        ...state.colWidth.$(),
        [start.col]: clamp(start.width + (x - start.x), start.min, start.max),
      },
    })
    return drag<ResizeStart, GridAction<TRow>, Intent<"header.pointerdown">>(
      intents<TRow, "header.pointerdown">(actions$, "header.pointerdown").pipe(
        filter((it) => it.part === "resize"),
      ),
      {
        from: (down) => {
          const def = defOf(ctx, down.col)
          if (def?.resizable === false) return null
          return {
            col: down.col,
            x: down.x,
            // The painted width, measured when the intent was built. A flex column has no declared
            // width, and `view.widths` reports declared intent, so reading it here dragged every
            // flex column from 100px whatever it looked like.
            width: down.width || ctx.view.widths.$().get(down.col) || DEFAULT_COL_WIDTH,
            min: def?.minWidth ?? 0,
            max: def?.maxWidth ?? Infinity,
          }
        },
        move: (start, e) => widthAt(start, e.clientX),
        commit: (start, e) => widthAt(start, e.clientX),
      },
      streams,
    )
  }
}

// --- Column move ------------------------------------------------------------

interface ColMoveStart {
  readonly col: ColId
  readonly x: number
  readonly order: readonly ColId[]
  readonly from: number
}

const reinsert = <K extends string>(order: readonly K[], from: number, to: number): readonly K[] => {
  const next = [...order]
  const [moved] = next.splice(from, 1)
  if (moved === undefined) return order
  next.splice(to, 0, moved)
  return next
}

const same = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((key, index) => key === b[index])

export function moveColumnOnHeaderDrag<TRow>(streams?: DragStreams): GridEpic<TRow> {
  return (actions$, state, ctx) => {
    // Measured against the order the drag started from, so travelling back to the origin restores
    // it rather than compounding every earlier swap.
    const landing = (start: ColMoveStart, x: number): GridAction<TRow> | null => {
      const widths = ctx.view.widths.$()
      const to = landingIndex(start.order, start.from, x - start.x, (key) => widths.get(key) ?? 0)
      const colOrder = reinsert(start.order, start.from, to)
      return same(colOrder, state.colOrder.$()) ? null : { phase: "change", type: "colOrder", colOrder }
    }
    return drag<ColMoveStart, GridAction<TRow>, Intent<"header.pointerdown">>(
      intents<TRow, "header.pointerdown">(actions$, "header.pointerdown").pipe(
        filter((it) => it.part === "move"),
      ),
      {
        from: (down) => {
          const order = colOrderOf(ctx)
          const from = order.indexOf(down.col)
          return from === -1 ? null : { col: down.col, x: down.x, order, from }
        },
        move: (start, e) => landing(start, e.clientX),
        commit: (start, e) => landing(start, e.clientX),
      },
      streams,
    )
  }
}

// --- Row move ---------------------------------------------------------------

interface RowMoveStart {
  readonly row: RowId
  readonly y: number
  readonly order: readonly RowId[]
  readonly from: number
}

export function moveRowOnRowDrag<TRow>(streams?: DragStreams): GridEpic<TRow> {
  return (actions$, _state, ctx) =>
    drag<RowMoveStart, GridAction<TRow>, Intent<"row.pointerdown">>(
      intents<TRow, "row.pointerdown">(actions$, "row.pointerdown"),
      {
        from: (down) => {
          const order = ctx.view.flat.$().map((it) => it.key)
          const from = order.indexOf(down.row)
          return from === -1 ? null : { row: down.row, y: down.y, order, from }
        },
        // Commit only. The grid does not own source order, so a per-move effect would ask the
        // consumer to rewrite its data once per pointermove.
        move: () => null,
        commit: (start, e) => {
          const to = landingIndex(start.order, start.from, e.clientY - start.y, ctx.rowHeight)
          if (to === start.from) return null
          const next = reinsert(start.order, start.from, to)
          return {
            phase: "effect",
            type: "reorderRow",
            row: start.row,
            before: next[to + 1] ?? null,
          }
        },
      },
      streams,
    )
}

// --- Keyboard ---------------------------------------------------------------

const firstCol = <TRow>(ctx: GridEpicCtx<TRow>): ColId | undefined => colOrderOf(ctx)[0]

// One switch over the key, because the arrows share the focus lookup that precedes them and
// splitting them into four epics would repeat it four times.
function keyAction<TRow>(
  intent: Intent<"key">,
  state: Sig<GridState>,
  ctx: GridEpicCtx<TRow>,
): GridAction<TRow> | null {
  const flat = ctx.view.flat.$()
  const focus = state.focus.$()
  const parts = focus === null ? null : cellParts(focus)
  const col = parts?.[1] ?? firstCol(ctx)
  if (col === undefined) return null
  const at = parts === null ? -1 : flat.findIndex((it) => it.key === parts[0])
  const node = at === -1 ? undefined : flat[at]
  const step = (delta: number): GridAction<TRow> | null => {
    const next = flat[clamp(at + delta, 0, flat.length - 1)]
    return next === undefined ? null : { phase: "change", type: "focus", focus: cellId(next.key, col) }
  }
  const open = (row: RowId, value: boolean): GridAction<TRow> => ({
    phase: "change",
    type: "expanded",
    expanded: { ...state.expanded.$(), [row]: value },
  })
  switch (intent.key) {
    // An unfocused grid sits at -1, so the first arrow of either sign lands on the first row.
    case "ArrowDown":
      return step(1)
    case "ArrowUp":
      return step(-1)
    case "ArrowRight":
      return node !== undefined && node.hasChildren && state.expanded.$()[node.key] !== true
        ? open(node.key, true)
        : null
    case "ArrowLeft": {
      if (node === undefined) return null
      if (node.hasChildren && state.expanded.$()[node.key] === true) return open(node.key, false)
      return node.parent === null
        ? null
        : { phase: "change", type: "focus", focus: cellId(node.parent, col) }
    }
    case " ": {
      if (node === undefined) return null
      const current = state.rowSelection.$()
      return {
        phase: "change",
        type: "rowSelection",
        rowSelection: { ...current, [node.key]: current[node.key] !== true },
      }
    }
    case "Enter": {
      if (node === undefined) return null
      const value = ctx.view.sorted.$().by.get(node.key)
      return value === undefined
        ? null
        : { phase: "effect", type: "activate", row: node.key, col, value }
    }
    default:
      return null
  }
}

export function keyboardNav<TRow>(): GridEpic<TRow> {
  return (actions$, state, ctx) =>
    intents<TRow, "key">(actions$, "key").pipe(
      map((it) => keyAction<TRow>(it, state, ctx)),
      emitted<TRow>(),
    )
}

// --- Paging -----------------------------------------------------------------

// The trigger is a function of scroll position rather than a counter, so scrolling the same
// boundary twice raises the index once: the next page moves the boundary out of reach.
export function pageOnScrollNearEnd<TRow>(): GridEpic<TRow> {
  return (actions$, state, ctx) =>
    intents<TRow, "viewport.scroll">(actions$, "viewport.scroll").pipe(
      map((it): GridAction<TRow> | null => {
        const page = state.page.$()
        if (page.mode !== "infinite") return null
        const size = Math.max(1, page.size)
        const loaded = (page.index + 1) * size
        if (page.total !== null && loaded >= page.total) return null
        const flat = ctx.view.flat.$()
        const last = flat[Math.min(loaded, flat.length) - 1]
        const height = ctx.rowHeight(last?.key ?? "")
        const bottom = it.top + ctx.viewport.$().height
        return bottom < (loaded - ctx.overscan) * height
          ? null
          : { phase: "change", type: "page", page: { ...page, index: page.index + 1 } }
      }),
      emitted<TRow>(),
    )
}

// --- Range selection --------------------------------------------------------

/** The gutter this grid renders. A down here opens a row block, so the cell epic steps aside. */
const ROW_HEADER_KINDS: ReadonlySet<BuiltInId> = new Set<BuiltInId>(["rowNumber", "check", "radio"])

const isRowHeader = <TRow>(ctx: GridEpicCtx<TRow>, col: ColId): boolean => {
  const def = defOf(ctx, col)
  return def !== undefined && isBuiltIn(def) && ROW_HEADER_KINDS.has(def.builtIn)
}

const selectionChange = <TRow>(range: GridSelection): GridAction<TRow> => ({
  phase: "change",
  type: "selection",
  selection: range,
})

/** Conventional going in, neutral coming out: a range is keyed by the two seats, never by name. */
const addressOf = (state: Sig<GridState>, row: RowId, col: ColId): CellId =>
  neutralCell(row, col, state.orientation.$())

/** What one range gesture reads off its own down intent. A null address rejects the down. */
interface RangeOpen<I> {
  readonly at: (down: I) => CellId | null
  readonly mods: (down: I) => Modifiers
  readonly mode: SelectionMode
}

// One gesture, three modes. `drag` owns the window and nothing else: a pointermove carries
// coordinates and a range is keyed by cells, so the head arrives as `cell.pointerenter` instead.
function rangeDrag<TRow, I>(
  down$: Observable<I>,
  open: RangeOpen<I>,
  actions$: Observable<GridAction<TRow>>,
  state: Sig<GridState>,
  streams: DragStreams | undefined,
): Observable<GridAction<TRow>> {
  // Gesture state, not grid state: null between gestures is what gates a plain hover out, since a
  // pointerenter with no button held reaches this epic exactly as a dragged one does.
  let live: GridSelection | null = null
  const addressFor = (down: I): CellId | null =>
    open.mods(down).button === 0 ? open.at(down) : null
  const opened = (down: I): GridAction<TRow> | null => {
    const address = addressFor(down)
    if (address === null) return null
    const mods = open.mods(down)
    const current = rangeOf(state.selection.$())
    // Shift extends the anchor the last down left. A different mode is a new gesture, so it
    // begins rather than extends.
    const extending = mods.shift && current.anchor !== null && current.mode === open.mode
    const next = extending
      ? extendTo(current, address)
      : beginAt(current, address, open.mode, mods.ctrl || mods.meta)
    live = next
    return selectionChange<TRow>(next)
  }
  const moved = (enter: Intent<"cell.pointerenter">): GridAction<TRow> | null => {
    const held = live
    if (held === null) return null
    const address = addressOf(state, enter.row, enter.col)
    // The binding is `pointerover`, which repeats inside one cell, and a head that did not move is
    // not a new rectangle.
    if (address === held.head) return null
    const next = extendTo(held, address)
    live = next
    return selectionChange<TRow>(next)
  }
  return merge(
    down$.pipe(map(opened), emitted<TRow>()),
    intents<TRow, "cell.pointerenter">(actions$, "cell.pointerenter").pipe(
      map(moved),
      emitted<TRow>(),
    ),
    drag<boolean, GridAction<TRow>, I>(
      down$,
      {
        from: (down) => (addressFor(down) === null ? null : true),
        move: () => null,
        commit: () => {
          const held = live
          live = null
          return held === null ? null : selectionChange<TRow>(commitBlock(held))
        },
      },
      streams,
    ),
  )
}

/** Escape clears whatever mode wrote the range, so it rides with the epic nobody drops. */
const clearOnEscape = <TRow>(
  actions$: Observable<GridAction<TRow>>,
  state: Sig<GridState>,
): Observable<GridAction<TRow>> =>
  intents<TRow, "key">(actions$, "key").pipe(
    filter((it) => it.key === "Escape"),
    map((): GridAction<TRow> | null => {
      const current = rangeOf(state.selection.$())
      return isRangeEmpty(current) ? null : selectionChange<TRow>(clearSelection(current))
    }),
    emitted<TRow>(),
  )

/** @feature cell.select */
export function selectCellsOnDrag<TRow>(streams?: DragStreams): GridEpic<TRow> {
  return (actions$, state, ctx) =>
    merge(
      rangeDrag<TRow, Intent<"cell.pointerdown">>(
        intents<TRow, "cell.pointerdown">(actions$, "cell.pointerdown"),
        {
          at: (down) =>
            isRowHeader(ctx, down.col) ? null : addressOf(state, down.row, down.col),
          mods: (down) => down.mods,
          mode: "cell",
        },
        actions$,
        state,
        streams,
      ),
      clearOnEscape<TRow>(actions$, state),
    )
}

export function selectRowsOnDrag<TRow>(streams?: DragStreams): GridEpic<TRow> {
  return (actions$, state, ctx) =>
    rangeDrag<TRow, Intent<"cell.pointerdown">>(
      intents<TRow, "cell.pointerdown">(actions$, "cell.pointerdown"),
      {
        at: (down) =>
          isRowHeader(ctx, down.col) ? addressOf(state, down.row, down.col) : null,
        mods: (down) => down.mods,
        mode: "row",
      },
      actions$,
      state,
      streams,
    )
}

// `part` is read as a bare string because the header part a range opens from is `"select"`, added
// to `GridIntent` by this lane's `0_types.ts` patch. Until that lands, no header down reaches here.
const opensColumnRange = (part: string): boolean => part !== "move" && part !== "resize"

export function selectColumnsOnDrag<TRow>(
  streams?: DragStreams,
  opensOn: (part: string) => boolean = opensColumnRange,
): GridEpic<TRow> {
  return (actions$, state) =>
    rangeDrag<TRow, Intent<"header.pointerdown">>(
      intents<TRow, "header.pointerdown">(actions$, "header.pointerdown").pipe(
        filter((it) => opensOn(it.part)),
      ),
      {
        // A header names a horizontal entry whichever axis stands there, and never a vertical one.
        at: (down) => columnAnchor(down.col),
        mods: (down) => down.mods,
        mode: "column",
      },
      actions$,
      state,
      streams,
    )
}

// --- The set ----------------------------------------------------------------

/** Every epic `grid()` installs. Each is exported alone so a consumer can drop one. */
export function defaultEpics<TRow>(streams?: DragStreams): readonly GridEpic<TRow>[] {
  return [
    sortOnHeaderClick<TRow>(),
    expandOnExpanderClick<TRow>(),
    selectRowsOnCheckboxClick<TRow>(),
    activateOnCellClick<TRow>(),
    resizeOnHeaderDrag<TRow>(streams),
    moveColumnOnHeaderDrag<TRow>(streams),
    moveRowOnRowDrag<TRow>(streams),
    keyboardNav<TRow>(),
    pageOnScrollNearEnd<TRow>(),
    selectCellsOnDrag<TRow>(streams),
    selectRowsOnDrag<TRow>(streams),
    selectColumnsOnDrag<TRow>(streams),
  ]
}
