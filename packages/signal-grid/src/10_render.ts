// @comment-ok: the frame and reconcile contract is this module's invariant and has no runtime home
// Plain DOM. No framework, no virtual tree, no diff of a tree that was rebuilt to be diffed.
//
// One derived node carries a whole frame, so a pass sees one consistent snapshot. Rows reconcile
// by key: a row already in the document is moved, never rebuilt, which is the only reason
// virtualization pays for itself. A cell rebuilds when the data behind it, the column run, or its
// editing state changed, and nothing else touches it.
// @no-features: the DOM pass. It renders what the view signals already decided, and each of those is tagged at its own stage
import { Subscription, type Observable } from "rxjs"
import { isSignal, Signal } from "@hafley66/signals"
import {
  CELL_SEP,
  cellId,
  cellParts,
  columnReader,
  type CellCtx,
  type CellId,
  type ColId,
  type ColumnDef,
  type FlatNode,
  type HeaderCtx,
  type Orientation,
  type Partitioned,
  type Renderable,
  type RowCtx,
  type RowId,
  type Side,
  type SlotContent,
  type SortDirection,
  type SortModel,
} from "./0_types.js"
import { CAT_DOM, CAT_FRAME, LOG } from "./0_log.js"
import { isBuiltIn } from "./5_columns.js"
import {
  addressedEntry,
  conventionalParts,
  NO_ENTRY,
  verticalOf,
  type AxisPair,
  type SpanRelation,
} from "./12_transpose.js"
import { rangeOf, selectionTest } from "./15_selection.js"
import { isDetailKey, rowOfDetailKey } from "./11_detail.js"
import {
  cellAttrs,
  expandAttrs,
  gridAttrs,
  headerAttrs,
  moveAttrs,
  resizeAttrs,
  rowAttrs,
  SG_DEPTH,
  rowHeightVar,
} from "./3_paths.js"
import { type RenderPlan, type Spacers } from "./4_slice.js"
import type { Grid } from "./8_grid.js"
import { SG_ROW_H, SG_ROW_HEIGHT_SELF, writeGridVars } from "./9_css.js"

export interface RenderHandle {
  readonly stop: () => void
}

const SIDES: readonly Side[] = ["start", "center", "end"]

/** Built-ins whose own glyph carries a route under the row. Their cell must not add a `c` segment. */
const ROW_ROUTED: ReadonlySet<string> = new Set(["check", "radio", "expand", "drag"])

const builtInOf = <TRow>(def: ColumnDef<TRow> | undefined): string | undefined =>
  def !== undefined && isBuiltIn(def) ? def.builtIn : undefined

const carriesRowRoute = <TRow>(def: ColumnDef<TRow> | undefined): boolean => {
  const kind = builtInOf(def)
  return kind !== undefined && ROW_ROUTED.has(kind)
}

const isExpandColumn = <TRow>(def: ColumnDef<TRow>): boolean => builtInOf(def) === "expand"

// Two names no axis can hold, so the seating chart can be asked which seat the row axis took
// without this file keeping a second copy of that table.
const ROW_SEAT = CELL_SEP + "row"
const COL_SEAT = CELL_SEP + "col"

/**
 * True when the run that scrolls is the row axis. Only that axis flattens against `expanded`: the
 * column axis is always fully open, so a disclosure on a header group is one that can never close.
 */
const rowsRunVertical = (orientation: Orientation): boolean =>
  conventionalParts(ROW_SEAT, COL_SEAT, orientation)[0] === ROW_SEAT

const asksToMove = <TRow>(def: ColumnDef<TRow> | undefined): boolean =>
  def?.movable === true

/** A row never rendered yet, distinct from a row whose data is genuinely absent. */
const UNRENDERED = Symbol("unrendered")

interface RowRecord {
  readonly el: HTMLElement
  colRunSignature: string
  /** Reference identity of the row's data, so a data reload rebuilds and a scroll does not. */
  data: unknown
  editing: CellId | null
  /** The row's cells by horizontal key, so a selection pass restamps without rebuilding them. */
  cells: Map<string, HTMLElement>
  /** Cell-level signal subscriptions. Torn down when the cells are rebuilt or the row leaves. */
  subs: Subscription
}

/** Everything a pass reads, collected inside the derived node so every read is tracked. */
interface Frame<TRow> {
  readonly gridId: string
  readonly plan: RenderPlan<RowId>
  readonly defs: ReadonlyMap<ColId, ColumnDef<TRow>>
  /** The horizontal run's nodes: columns under `"rows"`, rows under the transpose. */
  readonly horizontalNodes: ReadonlyMap<string, FlatNode<string>>
  readonly runs: Partitioned<ColId>
  /** The pixels the column window skipped, as the two tracks the center run has to cover. */
  readonly spacers: Spacers
  readonly colRunSignature: string
  /** Keyed by the horizontal run's entries, which are columns under `"rows"` and rows under the transpose. */
  readonly pinning: Readonly<Record<string, Side>>
  readonly orientation: Orientation
  readonly spans: SpanRelation
  readonly covered: ReadonlySet<CellId>
  readonly sort: SortModel
  readonly data: ReadonlyMap<RowId, TRow>
  /** False when the schema carries an `expandColumn()`, which is the same glyph in a seat. */
  readonly drawsExpander: boolean
  /** Whether the scrolling run is the row axis, which is the only one `expanded` reaches. */
  readonly rowsVertical: boolean
  readonly nodes: ReadonlyMap<RowId, FlatNode<RowId>>
  readonly selection: Readonly<Record<RowId, boolean>>
  /** The cell range as one predicate, with both axes indexed once. */
  readonly covers: (address: CellId) => boolean
  readonly verticalKeys: readonly string[]
  readonly horizontalKeys: readonly string[]
  readonly expanded: Readonly<Record<RowId, boolean>>
  /** The vertical run's declared sizes: row heights under `"rows"`, column widths transposed. */
  readonly extent: Readonly<Record<string, number>>
  readonly editing: CellId | null
}

export function render<TRow>(grid: Grid<TRow>, root: HTMLElement): RenderHandle {
  let gridId = grid.id.$()
  setAttrs(root, gridAttrs(gridId))
  root.classList.add("sg")

  // No `data-route`: `fromDelegatedRoute` joins every ancestor segment, so a routed box between the
  // grid and its rows would make each row read `g/vp/r`, a chain no template declares.
  const scroll = document.createElement("div")
  scroll.className = "sg-scroll"
  const head = box("sg-head")
  const pinnedStart = box("sg-rows sg-pinned-start")
  const canvas = box("sg-canvas")
  const center = box("sg-rows sg-center")
  const pinnedEnd = box("sg-rows sg-pinned-end")
  canvas.append(center)
  scroll.append(head, pinnedStart, canvas, pinnedEnd)
  root.append(scroll)

  const rows = new Map<RowId, RowRecord>()
  let headerSubs = new Subscription()
  // Null until the first pass, so an empty schema still builds its (empty) header once.
  let headKey: string | null = null
  let headSort: SortModel = []

  const frame = Signal<Frame<TRow>>(() => {
    if (!LOG.on) return frameBody()
    const started = performance.now()
    const built = frameBody()
    LOG.emit(CAT_FRAME, "frame {id} {durationMs}ms", {
      id: built.gridId,
      verticalCount: built.verticalKeys.length,
      horizontalCount: built.horizontalKeys.length,
      durationMs: performance.now() - started,
    })
    return built
  })

  // The timed branch reads the id off the frame it just built rather than the signal, so the memo's
  // dependency list is the same whether the sink is on or off.
  function frameBody(): Frame<TRow> {
    const schema = grid.columns.$()
    const defs = new Map(schema.map((col) => [col.id, col] as const))
    const nodes = grid.view.cols.$()
    const across = grid.view.horizontal.$()
    const down = grid.view.vertical.$()
    const pinning = across.pinning
    // The whole run, bands already dropped. The window cuts `runs.center` below; this list stays
    // whole because a selection edge asks about the neighbour of a cell the window may not hold.
    const leaves = grid.view.colLeaves.$()
    const colPlan = grid.view.colPlan.$()
    const spacers = grid.view.colSpacers.$()
    const runs: Partitioned<ColId> = {
      start: colPlan.start,
      center: colPlan.center,
      end: colPlan.end,
    }
    const orientation = grid.state.orientation.$()
    const rowsVertical = rowsRunVertical(orientation)
    return {
      gridId: grid.id.$(),
      plan: grid.view.plan.$(),
      defs,
      horizontalNodes: new Map(nodes.map((node) => [node.key, node] as const)),
      runs,
      spacers,
      // The spacer flag rides along: it decides how many tracks the center run spans, so a pass
      // that flips it has to rebuild the runs even when the same keys are in the window.
      colRunSignature: [runs.start, runs.center, runs.end]
        .map((run) => run.join(CELL_SEP))
        .join("|")
        .concat(spacers.tracked ? "|gap" : ""),
      pinning,
      orientation,
      spans: grid.view.spans.$(),
      covered: grid.view.covered.$(),
      sort: grid.state.sort.$(),
      // `detailed` rather than `sorted`: a panel node is only in the axis that carries panels, and
      // a key in the plan with no value renders an empty row.
      data: grid.view.detailed.$().by,
      // Also requires the axis to actually nest. A flat grid grew a glyph that could never open,
      // and under subgrid it now sits inside the first cell where it is impossible to miss.
      // A header group nests too, and under the transpose those groups are the run. The glyph
      // writes `expanded`, which only the row axis reads, so it stays off the column forest.
      drawsExpander:
        rowsVertical &&
        !schema.some(isExpandColumn) &&
        down.nodes.some((it: FlatNode<RowId>) => it.hasChildren),
      rowsVertical,
      // The vertical run's own nodes, so the plan and the records it builds share one key space.
      nodes: new Map(down.nodes.map((node) => [node.key, node] as const)),
      selection: grid.state.rowSelection.$(),
      covers: selectionTest(
        rangeOf(grid.state.selection.$()),
        down.nodes.map((it) => it.key),
        leaves,
      ),
      verticalKeys: down.nodes.map((it) => it.key),
      horizontalKeys: leaves,
      expanded: grid.state.expanded.$(),
      extent: down.extent,
      editing: grid.state.editing.$(),
    }
  }

  // --- header ---------------------------------------------------------------

  function headerCell(colId: ColId, current: Frame<TRow>, subs: Subscription): HTMLElement {
    const cell = box("sg-head-cell")
    setAttrs(cell, headerAttrs(colId))
    // The horizontal entry is a column under `"rows"` and a row under the transpose, and the band
    // stands on no vertical entry at all, so the seat it does not hold is `NO_ENTRY`.
    const entry = addressedEntry(NO_ENTRY, colId, current.orientation, current.defs, current.data)
    const def = entry.def
    const direction = sortOf(current.sort, colId)
    if (direction !== null) {
      cell.setAttribute("aria-sort", direction === "asc" ? "ascending" : "descending")
      cell.setAttribute("data-sort", direction)
    }
    const node = current.horizontalNodes.get(colId)
    // The label is an element rather than a text node because `g/h/move` needs one to sit on, and
    // a column that never asked to move keeps a bare box.
    const label = box("sg-head-label")
    if (asksToMove(def)) setAttrs(label, moveAttrs())
    cell.append(label)
    const slot = def?.headerCell ?? grid.slots.header
    // The slot is handed the horizontal entry's id under both seatings. Under the transpose that
    // entry is a row, so the slot also receives the row's id and data to label itself with; the
    // `ColumnDef.header` fallback only answers when the band holds columns.
    if (slot !== undefined && node !== undefined) {
      const ctx: HeaderCtx<TRow> = {
        col: colId,
        node,
        sort: direction,
        pinned: current.pinning[colId],
        row: entry.row === NO_ENTRY ? null : entry.row,
        data: entry.data,
      }
      mount(label, slot(ctx), subs)
    } else {
      label.append(def?.header ?? colId)
    }
    // The handle is a child of the header cell, so its chain is `g/h/resize` and the col id comes
    // from the ancestor rather than being stamped twice.
    if (def?.resizable === true) {
      const handle = box("sg-resize")
      setAttrs(handle, resizeAttrs())
      cell.append(handle)
    }
    return cell
  }

  function buildHeader(current: Frame<TRow>): void {
    headerSubs.unsubscribe()
    headerSubs = new Subscription()
    const runs: HTMLElement[] = []
    for (const side of SIDES) {
      const keys = current.runs[side]
      if (keys.length === 0) continue
      const run = openRun(side, keys.length, current.spacers)
      for (const colId of keys) run.append(headerCell(colId, current, headerSubs))
      runs.push(run)
    }
    head.replaceChildren(...runs)
  }

  // --- cells ----------------------------------------------------------------

  function cellFor(
    key: RowId,
    across: ColId,
    node: FlatNode<RowId>,
    current: Frame<TRow>,
    subs: Subscription,
  ): HTMLElement | null {
    // Neutral going in, conventional coming out: the address and the geometry are keyed by the two
    // seats, while a slot is handed the row and the column it has always been handed.
    const address = cellId(key, across)
    if (current.covered.has(address)) return null
    const entry = addressedEntry(key, across, current.orientation, current.defs, current.data)
    const { row, col, def } = entry
    // A glyph built-in carries its own row-level route, and a `c` segment above it would read
    // `g/r/c/check`, which no template declares, so those four cells stay routeless.
    const glyph = carriesRowRoute(def)
    const cell = box(glyph ? "sg-cell sg-cell-glyph" : "sg-cell")
    if (!glyph) setAttrs(cell, cellAttrs(col))
    // The ancestor row names the seat that scrolls, and under the transpose that is a column, so
    // the pair an intent reads would arrive swapped. Delegation takes each param from the closest
    // ancestor carrying it, so the cell's own copy is the one every epic and selector then sees.
    if (row !== key) setAttrs(cell, rowIdAttrs(row))
    const span = current.spans.get(address)
    if (span !== undefined) {
      cell.setAttribute("data-span", "true")
      cell.style.setProperty("--sg-span-vertical", String(span.vertical))
      cell.style.setProperty("--sg-span-horizontal", String(span.horizontal))
    }
    // Keyed by the conventional row, because `detailed` is the row axis's own map and a vertical
    // key under the transpose is a column, which owns no row value.
    const data = entry.data
    if (data === undefined) return cell
    const editing = current.editing === cellId(row, col)
    if (editing) cell.setAttribute("data-editing", "true")
    // A slot's node names the row it is about, so it comes off whichever seat the row axis took.
    const nodePair: AxisPair<FlatNode<string> | undefined> = [
      node,
      current.horizontalNodes.get(across),
    ]
    const ctx: CellCtx<TRow> = {
      row,
      col,
      data,
      value: readValue(def, data, col),
      node: verticalOf(nodePair, current.orientation) ?? node,
      editing,
    }
    // An editor in an anchor would navigate on the click that put the caret in it.
    const host = editing ? cell : linkIn(cell, hrefOf(grid, def, data))
    const slot = (editing ? grid.slots.editor : undefined) ?? def?.cell ?? grid.slots.cell
    if (slot === undefined) {
      host.append(textOf(ctx.value))
      return cell
    }
    mount(host, slot(ctx), subs)
    return cell
  }

  // A child of the run, not of a cell: a cell contributes a `c` segment and `g/r/c/expand` is a
  // chain no template declares. A leaf keeps the box so labels stay aligned.
  function expanderFor(
    key: RowId,
    node: FlatNode<RowId>,
    data: TRow | undefined,
    current: Frame<TRow>,
    subs: Subscription,
  ): HTMLElement {
    const el = box("sg-expander")
    setAttrs(el, expandAttrs())
    el.setAttribute("data-leaf", String(!node.hasChildren))
    const slot = grid.slots.expander
    if (slot !== undefined && data !== undefined) {
      mount(
        el,
        slot({
          row: key,
          data,
          node,
          selected: current.selection[key] === true,
          open: current.expanded[key] === true,
        }),
        subs,
      )
    }
    return el
  }

  function buildCells(
    record: RowRecord,
    key: RowId,
    node: FlatNode<RowId>,
    data: TRow | undefined,
    current: Frame<TRow>,
  ): void {
    record.subs.unsubscribe()
    const subs = new Subscription()
    record.subs = subs
    const runs: HTMLElement[] = []
    let leading = true
    record.cells.clear()
    for (const side of SIDES) {
      const keys = current.runs[side]
      if (keys.length === 0) continue
      const run = openRun(side, keys.length, current.spacers)
      const built: HTMLElement[] = []
      for (const across of keys) {
        const cell = cellFor(key, across, node, current, subs)
        // Null is a seat a neighbour's span already occupies, and two elements in one seat is how
        // a spanning grid tears.
        if (cell === null) continue
        built.push(cell)
        record.cells.set(across, cell)
      }
      // Under subgrid the expander would occupy track 1 and shift every column by one, and the
      // header never builds one, so the two bands would disagree. It belongs inside the first
      // cell, where the indent it draws already lives.
      const first = built[0]
      if (leading && current.drawsExpander && first !== undefined) {
        first.prepend(expanderFor(key, node, data, current, subs))
        leading = false
      }
      for (const cell of built) run.append(cell)
      runs.push(run)
    }
    record.el.replaceChildren(...runs)
  }

  // --- detail panels --------------------------------------------------------

  // One full-width box, not a second set of cells: a panel spans the row it hangs under, and the
  // `RowCtx` names that owning row rather than the synthetic key the axis inserted.
  function buildPanel(
    record: RowRecord,
    owner: RowId,
    node: FlatNode<RowId>,
    data: TRow | undefined,
    current: Frame<TRow>,
  ): void {
    record.subs.unsubscribe()
    const subs = new Subscription()
    record.subs = subs
    const panel = box("sg-detail-panel")
    const slot = grid.slots.detail
    if (slot !== undefined && data !== undefined) {
      const ctx: RowCtx<TRow> = {
        row: owner,
        data,
        node,
        selected: current.selection[owner] === true,
        open: current.expanded[owner] === true,
      }
      mount(panel, slot(ctx), subs)
    }
    record.el.replaceChildren(panel)
  }

  // --- rows -----------------------------------------------------------------


  // Selection is not a rebuild: a drag writes the range on every hover edge, and rebuilding the
  // cells for it would tear down the editor and every slot subscription under them.
  function stampSelection(
    record: RowRecord,
    key: RowId,
    node: FlatNode<RowId>,
    current: Frame<TRow>,
  ): void {
    const run = current.horizontalKeys
    for (let index = 0; index < run.length; index++) {
      const across = run[index]
      if (across === undefined) continue
      const cell = record.cells.get(across)
      if (cell === undefined) continue
      const on = current.covers(cellId(key, across))
      // Written only on the edge: an attribute set to the value it already holds still invalidates
      // style, and this runs for every visible cell of every frame.
      if (on !== cell.hasAttribute("data-selected")) {
        if (on) cell.setAttribute("data-selected", "true")
        else cell.removeAttribute("data-selected")
      }
      if (!on) {
        cell.removeAttribute("data-edge")
        continue
      }
      const edge = edgeOf(current, key, node.index, index)
      if (cell.getAttribute("data-edge") !== edge) cell.setAttribute("data-edge", edge)
    }
  }

  /** Which sides of the block a selected cell sits on, so one rectangle draws one border. */
  function edgeOf(
    current: Frame<TRow>,
    key: RowId,
    atVertical: number,
    atHorizontal: number,
  ): string {
    const down = current.verticalKeys
    const run = current.horizontalKeys
    const holds = (vertical: string | undefined, horizontal: string | undefined): boolean =>
      vertical !== undefined &&
      horizontal !== undefined &&
      current.covers(cellId(vertical, horizontal))
    const across = run[atHorizontal]
    const edges: string[] = []
    if (!holds(down[atVertical - 1], across)) edges.push("top")
    if (!holds(down[atVertical + 1], across)) edges.push("bottom")
    if (!holds(key, run[atHorizontal - 1])) edges.push("start")
    if (!holds(key, run[atHorizontal + 1])) edges.push("end")
    return edges.join(" ")
  }

  function ensureRow(key: RowId, current: Frame<TRow>): RowRecord | undefined {
    const node = current.nodes.get(key)
    // A key in the plan with no node behind it is a plan built against an older flat list. The
    // next emission carries both, so skipping is a frame of nothing rather than a wrong row.
    if (node === undefined) return undefined
    const panel = isDetailKey(key)
    // The panel answers to its owning row: a detail key holds a NUL no selector can spell, and an
    // intent raised inside a panel means the row it belongs to.
    const owner = rowOfDetailKey(key)
    let record = rows.get(key)
    if (record === undefined) {
      const el = box(panel ? "sg-row sg-detail-row" : "sg-row")
      setAttrs(el, rowAttrs(owner))
      if (panel) el.setAttribute("data-detail", "true")
      record = {
        el,
        colRunSignature: "",
        data: UNRENDERED,
        editing: null,
        cells: new Map(),
        subs: new Subscription(),
      }
      rows.set(key, record)
    }
    const data = current.data.get(key)
    // The rebuild key falls back to the map itself: a vertical entry under the transpose is a
    // column, which owns no row value, and the map is one identity until the data reloads.
    const identity: unknown = data ?? current.data
    const editing = panel ? null : editingIn(current.editing, key, current.orientation)
    if (record.colRunSignature !== current.colRunSignature || record.data !== identity || record.editing !== editing) {
      if (panel) buildPanel(record, owner, node, data, current)
      else buildCells(record, key, node, data, current)
      record.colRunSignature = current.colRunSignature
      record.data = identity
      record.editing = editing
    }
    // Depth rides on the row so every cell in it reads one property, and the indent is CSS. Under
    // the transpose the depth on this seat is a header group's, and the indent it would draw is a
    // tree the run does not have, so the band stays flush.
    record.el.style.setProperty(SG_DEPTH, String(current.rowsVertical ? node.depth : 0))
    // A row's height property is named after its id, which no stylesheet selector can spell, so
    // the generic rule reads this alias. Written here because this is where the element is held.
    if (current.extent[key] === undefined) record.el.style.removeProperty(SG_ROW_HEIGHT_SELF)
    else record.el.style.setProperty(SG_ROW_HEIGHT_SELF, `var(${rowHeightVar(key)}, var(${SG_ROW_H}))`)
    record.el.setAttribute("data-selected", String(current.selection[owner] === true))
    stampSelection(record, key, node, current)
    record.el.setAttribute("data-open", String(current.expanded[owner] === true))
    if (node.hasChildren) record.el.setAttribute("aria-expanded", String(current.expanded[owner] === true))
    else record.el.removeAttribute("aria-expanded")
    return record
  }

  // Cursor walk. `insertBefore` on a node already in another host moves it across hosts, which is
  // how a row travels between the pinned runs and the center without being rebuilt.
  function reconcile(
    host: HTMLElement,
    keys: readonly RowId[],
    current: Frame<TRow>,
    seen: Set<RowId>,
  ): void {
    let cursor: ChildNode | null = host.firstChild
    for (const key of keys) {
      // A slot signal that emits synchronously can call `stop()` from inside `ensureRow`, and the
      // rest of this walk would then build rows into a tree nothing owns.
      if (stopped) return
      const record = ensureRow(key, current)
      if (record === undefined) continue
      seen.add(key)
      if (record.el === cursor) {
        cursor = cursor.nextSibling
        continue
      }
      host.insertBefore(record.el, cursor)
    }
  }

  function pass(current: Frame<TRow>): void {
    if (!LOG.on) return passBody(current)
    const started = performance.now()
    passBody(current)
    LOG.emit(CAT_DOM, "dom {id} {durationMs}ms", {
      id: current.gridId,
      drawn: current.plan.start.length + current.plan.center.length + current.plan.end.length,
      held: rows.size,
      durationMs: performance.now() - started,
    })
  }

  function passBody(current: Frame<TRow>): void {
    if (stopped) return
    if (current.gridId !== gridId) {
      gridId = current.gridId
      setAttrs(root, gridAttrs(gridId))
    }
    if (current.colRunSignature !== headKey || current.sort !== headSort) {
      buildHeader(current)
      headKey = current.colRunSignature
      headSort = current.sort
    }
    const seen = new Set<RowId>()
    reconcile(pinnedStart, current.plan.start, current, seen)
    reconcile(center, current.plan.center, current, seen)
    reconcile(pinnedEnd, current.plan.end, current, seen)
    if (stopped) return
    for (const [key, record] of rows) {
      if (seen.has(key)) continue
      record.subs.unsubscribe()
      record.el.remove()
      rows.delete(key)
    }
  }

  const subscription = new Subscription()
  let stopped = false
  // `bindRoot` listens for keydown on the root, and an element with no tabindex never receives one,
  // so every keyboard epic was unreachable by default. Set only when the consumer left it unset.
  if (!root.hasAttribute("tabindex")) root.tabIndex = 0

  // Bound before the first pass, so the header this pass builds is already clickable.
  subscription.add(grid.bind(root))
  subscription.add(frame.$.subscribe(pass))

  // Nothing else feeds the viewport, and infinite paging plus virtualization both read it, so the
  // listener pair lives here rather than in every consumer.
  const onScroll = (): void => {
    const top = scroll.scrollTop
    const left = scroll.scrollLeft
    // The signal drives the window, the intent drives the epics. Writing only the intent left
    // virtualization frozen at the top of the list, since `plan` reads the signal.
    grid.viewport.$({ ...grid.viewport.$(), top, left })
    grid.dispatch({ phase: "intent", type: "viewport.scroll", top, left })
  }
  scroll.addEventListener("scroll", onScroll, { passive: true })
  subscription.add(() => scroll.removeEventListener("scroll", onScroll))

  const observer = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (entry === undefined) return
    const { width, height } = entry.contentRect
    grid.viewport.$({ ...grid.viewport.$(), width, height })
    grid.dispatch({ phase: "intent", type: "viewport.resize", width, height })
  })
  observer.observe(scroll)
  subscription.add(() => observer.disconnect())

  // Every teardown joins the one Subscription: it collects errors instead of propagating them, so
  // a slot whose teardown throws cannot leave the rows below it subscribed.
  subscription.add(writeGridVars(grid, root))
  subscription.add(() => headerSubs.unsubscribe())
  subscription.add(() => {
    // Gathered under one parent so a throwing cell teardown cannot skip the rows after it.
    const held = new Subscription()
    for (const record of rows.values()) held.add(record.subs)
    rows.clear()
    held.unsubscribe()
  })
  subscription.add(() => scroll.remove())

  return {
    stop: () => {
      stopped = true
      subscription.unsubscribe()
    },
  }
}

// --- content ----------------------------------------------------------------

/** Pulls a teardown out of a slot's return, leaving the content or signal the branches below read. */
const split = (
  content: SlotContent,
): {
  readonly body: Renderable | { readonly $: Observable<Renderable> }
  readonly unsubscribe: (() => void) | undefined
} => {
  if (typeof content === "object" && content !== null && "unsubscribe" in content) {
    const held = content as {
      readonly content?: Renderable
      readonly $?: Observable<Renderable>
      readonly unsubscribe: () => void
    }
    return {
      body: held.$ !== undefined ? { $: held.$ } : (held.content as Renderable),
      unsubscribe: held.unsubscribe,
    }
  }
  return { body: content as Renderable | { readonly $: Observable<Renderable> }, unsubscribe: undefined }
}

/** A signal slot subscribes one node into the row's `Subscription`, so a recycled cell cannot keep
 * writing into a node that now belongs to another row. */
function mount(host: HTMLElement, content: SlotContent, subs: Subscription): void {
  const held = split(content)
  // A slot's teardown joins the same Subscription as its content's, so a throwing content teardown
  // cannot skip the rows below it and a row leaving tears both down together.
  if (held.unsubscribe !== undefined) subs.add(held.unsubscribe)
  const body = held.body
  if (!isSignal<unknown>(body)) {
    // The cast survives the union change: `isSignal` narrows on `SignalType<unknown>`, so the
    // `Renderable` members of the union stay reachable in this branch.
    append(host, body as Renderable)
    return
  }
  // An emission replaces only what the previous one inserted: the resize handle is appended after
  // this call, and `textContent` would take it with it. The anchor holds the insertion point.
  const anchor = document.createComment("sg")
  host.append(anchor)
  let owned: readonly ChildNode[] = []
  subs.add(
    // The cast is on the emission, not the stream: `isSignal` narrows `$` to `SignalType<unknown>`,
    // so the callback parameter is typed `unknown` no matter what `Slot` declared.
    body.$.subscribe((next) => {
      for (const node of owned) node.remove()
      const batch = document.createDocumentFragment()
      append(batch, next as Renderable)
      owned = [...batch.childNodes]
      host.insertBefore(batch, anchor)
    }),
  )
}

function append(host: ParentNode, value: Renderable): void {
  if (value === null || value === undefined || typeof value === "boolean") return
  if (typeof value === "string" || typeof value === "number") {
    host.append(String(value))
    return
  }
  if (Array.isArray(value)) {
    for (const item of value as readonly Renderable[]) append(host, item)
    return
  }
  if (typeof Node !== "undefined" && value instanceof Node) {
    host.append(value)
    return
  }
  // What is left matched `Renderable` through `$$typeof`, which is a React element. Nothing here
  // can mount one, and a consumer holding one wants the React entry point instead of this.
}

// --- links ------------------------------------------------------------------

/** A column's own target beats the row's. A built-in column holds a control rather than a value,
 * so a row link never covers one: the click there belongs to the glyph. */
const hrefOf = <TRow>(
  grid: Grid<TRow>,
  def: ColumnDef<TRow> | undefined,
  row: TRow,
): string | undefined =>
  def?.href?.(row) ?? (def !== undefined && isBuiltIn(def) ? undefined : grid.rowHref?.(row))

// The anchor wraps the content and never becomes the cell. The cell is the grid item carrying the
// route, the span tracks, and the selection stamp, and an anchor in that seat would hold all three.
function linkIn(cell: HTMLElement, href: string | undefined): HTMLElement {
  if (href === undefined) return cell
  const link = document.createElement("a")
  link.className = "sg-link"
  link.href = href
  // A cell range drag opens in this seat, and the browser's own link drag would take the gesture.
  link.draggable = false
  cell.append(link)
  return link
}

const textOf = (value: unknown): string =>
  value === null || value === undefined
    ? ""
    : typeof value === "symbol"
      ? value.toString()
      : String(value)

const readValue = <TRow>(def: ColumnDef<TRow> | undefined, row: TRow, colId: ColId): unknown =>
  columnReader(def, colId)(row)

// --- element helpers --------------------------------------------------------

const box = (className: string): HTMLElement => {
  const el = document.createElement("div")
  el.className = className
  return el
}

// Subgrid inherits the parent's track list, and a run holding a subset of it has to say how many
// tracks it occupies. The count is the run's own key count, so the three runs tile the row exactly.
const runBox = (side: Side, tracks: number): HTMLElement => {
  const el = box("sg-run")
  // No `data-route`: a run between a row and its cells would lengthen every cell chain.
  el.setAttribute("data-side", side)
  el.style.gridColumn = `span ${Math.max(1, tracks)}`
  return el
}

/** An empty box takes the leading spacer track, so auto-placement puts every cell on the track its
 * own column occupies and no index arithmetic here has to match `9_css.ts`. Center run only. */
function openRun(side: Side, count: number, spacers: Spacers): HTMLElement {
  if (side !== "center" || !spacers.tracked) return runBox(side, count)
  const run = runBox(side, count + 2)
  run.append(box("sg-spacer"))
  return run
}

const ROUTE_ATTR = "data-route"

/**
 * The row id alone. `rowAttrs` also carries the row's route segment, and a second copy of that on
 * a cell would lengthen the chain delegation composes to `g/r/r/c`, which no template declares.
 * Taken off `rowAttrs` rather than spelled again, so the attribute name has one declaration.
 */
const rowIdAttrs = (rowId: RowId): Record<string, string> =>
  Object.fromEntries(Object.entries(rowAttrs(rowId)).filter(([name]) => name !== ROUTE_ATTR))

const setAttrs = (el: Element, attrs: Readonly<Record<string, string>>): void => {
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value)
}

const sortOf = (model: SortModel, colId: ColId): SortDirection | null => {
  for (const item of model) {
    if (item.field === colId) return item.sort
  }
  return null
}

/**
 * Only the edited cell's own row rebuilds, so the comparison is scoped to this row's id. The state
 * holds a conventional address and the records are keyed by the seat, so it crosses first.
 */
const editingIn = (
  editing: CellId | null,
  key: RowId,
  orientation: Orientation,
): CellId | null => {
  if (editing === null) return null
  const parts = cellParts(editing)
  // Its own inverse, so handing it a conventional pair returns the neutral one.
  const [vertical] = conventionalParts(parts[0], parts[1], orientation)
  return vertical === key ? editing : null
}
