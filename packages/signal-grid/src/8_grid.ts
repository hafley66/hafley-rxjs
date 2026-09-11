// The constructor. Takes sources, returns signals. There are no value/onChange pairs anywhere:
// a signal is both halves already, so a caller's signal is controlled by holding it and nothing else.
import { fromEvent, isObservable, Observable, Subscription, filter as rxFilter, map, share } from "rxjs"
import { ROUTE_BOUNDARY_ATTR } from "@hafley66/xdom"
import { createSlice, isSignal, Signal, storageSignal, urlAdapter } from "@hafley66/signals"
import { CAT_FLATTEN, CAT_GROUP, CAT_INTENT, CAT_PLAN, CAT_SORT, LOG } from "./0_log.js"
import { axisOfEntries, axisOfTree, flattenAxis, groupAxis, sortAxis } from "./1_axis.js"
import { buildComparator } from "./2_operators.js"
import { withDetail } from "./11_detail.js"
import {
  measuredSizer,
  renderPlan,
  spacersOf,
  uniformSizer,
  type RenderPlan,
  type RenderPlanInput,
  type Sizer,
  type Spacers,
} from "./4_slice.js"
import { gridDom, intentOf } from "./3_paths.js"
import {
  collapseToOneEntry,
  coveredBy,
  horizontalFacet,
  neutralCell,
  neutralSpan,
  verticalFacet,
  verticalOf,
  NO_COVER,
  NO_SPANS,
  type AxisFacet,
  type CellSpan,
  type FacetPair,
  type SpanRelation,
} from "./12_transpose.js"
import { checkBands } from "./18_bands.js"
import { defaultEpics, type GridEpic, type GridEpicCtx } from "./7_epics.js"
import { EMPTY_RANGE } from "./15_selection.js"
import {
  columnReader,
  GROUP_PREFIX,
  type Axis,
  type CellId,
  type ColId,
  type ColumnDef,
  type FlatNode,
  type GridAction,
  type GridChange,
  type GridEffect,
  type GridIntent,
  type GridMode,
  type GridState,
  type Page,
  type PageRequest,
  type QueryDescriptor,
  type RowId,
  type Slots,
  type Viewport,
  type SortModel,
} from "./0_types.js"

// --- Inputs -----------------------------------------------------------------

/**
 * Every input accepts any source shape, so a live input and a static one are the same call.
 * `@hafley66/signals` already carries this as `SignalSource`; the grid adds a fallback so a live
 * source that has not emitted yet still has a first value to derive from.
 */
export type GridSource<T> = Signal<T> | Observable<T> | (() => T) | T

export function toGridSignal<T>(source: GridSource<T>, fallback: T): Signal<T> {
  if (isSignal<T>(source)) return source
  if (isObservable(source)) return Signal<T>(source as Observable<T>, fallback)
  if (typeof source === "function") return Signal<T>(source as () => T)
  return Signal<T>(source as T)
}

// --- Defaults ---------------------------------------------------------------

/** Mirrors `4_slice.ts`'s track default. Declared here so the sizing lane owns that file alone. */
const DEFAULT_COL_WIDTH = 100

export const DEFAULT_PAGE: Page = { mode: "all", index: 0, size: 100, total: null }

export function defaultState(over: Partial<GridState> = {}): GridState {
  return {
    sort: [],
    group: [],
    expanded: {},
    rowSelection: {},
    rowPinning: {},
    rowHeight: {},
    rowOrder: [],
    detail: {},
    page: DEFAULT_PAGE,
    colOrder: [],
    colHidden: {},
    colWidth: {},
    colPinning: {},
    selection: EMPTY_RANGE,
    focus: null,
    editing: null,
    density: "standard",
    listView: false,
    orientation: "rows",
    virtualize: { vertical: true, horizontal: false },
    ...over,
  }
}

/** Every key of `GridState`, read off the defaults so a new one joins the mirror by existing. */
const STATE_KEYS = Object.keys(defaultState()) as readonly (keyof GridState)[]

/** The horizontal run is never the axis a pager retains, so its plan is handed the identity page. */
const NO_PAGE = { index: 0, size: 0 } as const

/** @feature-declared view.density */
export const ROW_HEIGHT: Record<GridState["density"], number> = {
  compact: 28,
  standard: 36,
  comfortable: 48,
}

// --- Config -----------------------------------------------------------------

export interface GridConfig<TRow> {
  readonly id: GridSource<string>
  readonly rows: GridSource<readonly TRow[]>
  readonly columns: GridSource<readonly ColumnDef<TRow>[]>
  /** Identity is deliberately not reactive: a changing row id is a data reload, not a state change. */
  readonly rowId: (row: TRow) => RowId
  /** Supplying this is the whole of tree mode. */
  readonly subRows?: (row: TRow) => readonly TRow[] | undefined
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
}

// --- The view chain ---------------------------------------------------------

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
}

const byPhase = <TRow, P extends GridAction<TRow>["phase"]>(
  actions$: Observable<GridAction<TRow>>,
  phase: P,
): Observable<Extract<GridAction<TRow>, { phase: P }>> =>
  actions$.pipe(rxFilter((it): it is Extract<GridAction<TRow>, { phase: P }> => it.phase === phase))

const reduce = <TRow>(state: GridState, action: GridAction<TRow>): GridState =>
  action.phase === "change"
    ? { ...state, [action.type]: (action as unknown as Record<string, unknown>)[action.type] }
    : state

/**
 * The three retention rules of `PageMode` expressed as one `paginate` call, so paging runs inside
 * `renderPlan` after pinning has already been lifted out. Paging before pinning drops pinned
 * rows off the page they happen not to sit on, which defeats the point of pinning them.
 * @feature page.infinite
 */
export function pageWindow(page: Page): { page: { index: number; size: number }; enabled: boolean } {
  const size = Math.max(1, page.size)
  if (page.mode === "all") return { page: { index: 0, size }, enabled: false }
  if (page.mode === "infinite") return { page: { index: 0, size: (page.index + 1) * size }, enabled: true }
  return { page: { index: page.index, size }, enabled: true }
}


// `Signal(() => ...)` recomputes whenever a dependency emits. A nested-path selector pipes
// `distinctShallow` by default (`packages/signals/src/1_SignalCreator.ts:55`, applied at
// `1_SignalCreator.ts:334`), so a sibling write reaches a derived stage only when that branch's
// value changed shallowly. Holding the inputs and returning the previous output when every one is
// reference-identical keeps the expensive stages from re-running on the writes that still get
// through.
export function grid<TRow>(config: GridConfig<TRow>): Grid<TRow> {
  const mode: GridMode = config.mode ?? "client"
  const id = toGridSignal(config.id, "grid")
  const rows = toGridSignal<readonly TRow[]>(config.rows, [])
  const columns = toGridSignal<readonly ColumnDef<TRow>[]>(config.columns, [])
  const rowCount = toGridSignal<number | null>(config.rowCount ?? null, null)
  const viewport = toGridSignal<Viewport>(config.viewport ?? { top: 0, left: 0, width: 0, height: 0 }, {
    top: 0,
    left: 0,
    width: 0,
    height: 0,
  })

  // A column carrying both a `field` and a `value` says two things about one read, so the schema
  // is rejected at construction rather than at whichever cell asks first.
  for (const col of columns.$()) columnReader(col, col.id)
  checkBands(columns.$())

  // Every other input goes through `toGridSignal`, so a plain object here must too. Three of the
  // four shapes emit again, and the signal is kept so those emissions have somewhere to land.
  const stateSource =
    config.state === undefined ? undefined : toGridSignal<Partial<GridState>>(config.state, {})
  const stateSeed = stateSource?.$()
  const seed = defaultState(stateSeed)
  // Read once, outside every memo. Reading `id` inside one would put it on that memo's dependency
  // list while logging is on, and a write to the id would then recompute stages it never fed.
  const loggedId = id.$()
  const syncKey = config.sync === true ? id.$() : typeof config.sync === "string" ? config.sync : null
  const synced = syncKey === null ? null : storageSignal(urlAdapter(syncKey), seed)
  const store: Signal<GridState> = synced ?? Signal<GridState>(seed)

  // What the constructor opened, the constructor hands back. `bind` and `render` each release what
  // they opened themselves, but `urlAdapter` puts a `popstate` listener on the window before either
  // exists, and its closure pins the state signal and the whole derived chain behind it. Until this
  // door existed, every `grid({ sync })` leaked one of those for the life of the page.
  const opened = new Subscription()
  if (synced !== null) opened.add(() => synced.close())

  // A getter, because the epics read the derived view and the view is built below out of
  // `slice.state`, which does not exist yet.
  const epicCtx: GridEpicCtx<TRow> = {
    get view() {
      return view
    },
    columns,
    viewport,
    rowHeight: (row) => state.rowHeight.$()[row] ?? ROW_HEIGHT[state.density.$()],
    overscan: config.overscan ?? 4,
  }

  const slice = createSlice<GridState, GridAction<TRow>, GridEpicCtx<TRow>>({
    initial: store.$(),
    state: store,
    reduce,
    epics: config.epics ?? defaultEpics<TRow>(),
    ctx: epicCtx,
  })
  const state = slice.state
  const actions$ = slice.actions$

  // One record per intent. A live render subscribes the frame, so the DOM pass the intent causes
  // runs inside this call and the number covers the click through to the repaint.
  const dispatch = (action: GridAction<TRow>): void => {
    if (!LOG.on || action.phase !== "intent") return slice.dispatch(action)
    const started = performance.now()
    slice.dispatch(action)
    LOG.emit(CAT_INTENT, "intent {type} {durationMs}ms", {
      id: loggedId,
      type: action.type,
      durationMs: performance.now() - started,
    })
  }

  // `Partial<GridState>` is the caller naming which keys are theirs. A key they never send stays
  // untouched, so `colHidden` cannot undo a sort the user just made; a key they send wins over it.
  if (stateSource !== undefined) {
    // Only a signal the caller still holds is worth writing back to. The other three shapes
    // produce one the grid alone holds, and a write out would land where nobody reads it.
    const held = isSignal<Partial<GridState>>(config.state) ? config.state : undefined
    let mirrored = state.$()
    // What goes out is the keys the caller carries plus the keys this change moved, so `Partial`
    // keeps meaning the keys that are theirs after a click adds one.
    const mirrorOut = (): void => {
      if (held === undefined) return
      const before = mirrored
      const next = state.$()
      mirrored = next
      const outward = held.$()
      const outgoing: Record<string, unknown> = {}
      let moved = false
      for (const key of STATE_KEYS) {
        if (!(key in outward) && Object.is(before[key], next[key])) continue
        outgoing[key] = next[key]
        if (!Object.is(outward[key], next[key])) moved = true
      }
      if (moved) held.$(outgoing as Partial<GridState>)
    }
    // The loop closes on values. A write out re-enters the reader below, which finds every key
    // already equal and dispatches nothing, so one change costs the caller's signal one emission.
    let applying = false
    if (held !== undefined) opened.add(state.$.subscribe(() => { if (!applying) mirrorOut() }))
    let consumed = stateSeed
    opened.add(
      stateSource.$.subscribe((patch) => {
        // The subject replays the seed to every new subscriber, and identity tells that apart.
        if (patch === consumed) return
        consumed = patch
        const current = state.$()
        applying = true
        // One pass out after the whole patch lands, so a two-key emission cannot mirror the first
        // key back beside the default of the second.
        try {
          for (const key of Object.keys(patch) as readonly (keyof GridState)[]) {
            const next = patch[key]
            if (next === undefined || Object.is(current[key], next)) continue
            dispatch({ phase: "change", type: key, [key]: next } as unknown as GridChange)
          }
        } finally {
          applying = false
        }
        mirrorOut()
      }),
    )
  }

  // --- derivation, one computed signal per algebra stage ---------------------

  // Column lookup by id, hoisted. A linear `find` inside a comparator runs once per comparison,
  // so a 10k-row sort over 30 columns walked the column array 130k times for no reason.
  const byId = Signal<ReadonlyMap<ColId, ColumnDef<TRow>>>(
    () => new Map(columns.$().map((it) => [it.id, it] as const)),
  )
  const readerFor = (cols: ReadonlyMap<ColId, ColumnDef<TRow>>, field: ColId) =>
    columnReader(cols.get(field), field)

  const base = Signal<Axis<RowId, TRow>>(() => {
    const data = rows.$()
    return config.subRows
      ? axisOfTree(data, config.rowId, config.subRows)
      : axisOfEntries(data.map((row) => [config.rowId(row), row] as const))
  })

  // Server mode already applied grouping and sorting upstream; re-running them locally over one
  // page would reorder that page against the rest of the result.
  const groupValue = (path: readonly unknown[], key: RowId): TRow =>
    ({ [GROUP_PREFIX]: key, path }) as unknown as TRow

  const grouped = Signal<Axis<RowId, TRow>>(() => {
    const axis = base.$()
    if (mode === "server") return axis
    const keys = state.group.$()
    if (!keys.length) return axis
    const cols = byId.$()
    const readers = keys.map((field) => readerFor(cols, field))
    // The timed branch stands after every early return, so nothing above it is reached differently
    // when the sink is on.
    if (!LOG.on) return groupAxis(axis, readers, groupValue)
    const started = performance.now()
    const built = groupAxis(axis, readers, groupValue)
    LOG.emit(CAT_GROUP, "group {id} {durationMs}ms", {
      id: loggedId,
      levels: keys.length,
      count: built.by.size,
      durationMs: performance.now() - started,
    })
    return built
  })

  // `sort` names a field, and the axis standing vertical is the one ordered by it. Under the
  // transpose that is the column axis, so the row axis is handed an empty model rather than a
  // second stage that knows what a transpose is. Both seats are thunks: the seat that is not
  // chosen never reads `state.sort`, so it is not woken by a write to it either.
  const NO_MODEL = (): SortModel => []
  const rowModel = (): SortModel => state.sort.$()

  const sorted = Signal<Axis<RowId, TRow>>(() =>
    sortBody(grouped.$(), verticalOf([rowModel, NO_MODEL], state.orientation.$())(), columns.$()),
  )

  function sortBody(axis: Axis<RowId, TRow>, model: SortModel, defs: readonly ColumnDef<TRow>[]): Axis<RowId, TRow> {
    if (mode === "server") return axis
    // The comparator build is inside the measurement because a 30-column schema pays for it on
    // every sort write, and a demo asking what a sort cost is asking for both halves.
    if (!LOG.on) return sortOnce(axis, model, defs)
    const started = performance.now()
    const built = sortOnce(axis, model, defs)
    LOG.emit(CAT_SORT, "sort {id} {durationMs}ms", {
      id: loggedId,
      keys: model.length,
      count: built.by.size,
      durationMs: performance.now() - started,
    })
    return built
  }

  function sortOnce(axis: Axis<RowId, TRow>, model: SortModel, defs: readonly ColumnDef<TRow>[]): Axis<RowId, TRow> {
    const cols = new Map(defs.map((it) => [it.id, it] as const))
    const readers = new Map(model.map((item) => [item.field, readerFor(cols, item.field)] as const))
    const cmp = buildComparator<TRow>(model, defs, (row, field) =>
      (readers.get(field) ?? readerFor(cols, field))(row),
    )
    return sortAxis(axis, cmp)
  }

  const detailed = Signal<Axis<RowId, TRow>>(() => {
    const axis = sorted.$()
    // The panel's value is the row's own, so a detail slot reads the row it hangs under.
    return withDetail(axis, state.detail.$(), (row) => axis.by.get(row))
  })

  const flat = Signal<readonly FlatNode<RowId>[]>(() => {
    const open = state.expanded.$()
    const axis = detailed.$()
    const isOpen = (key: RowId): boolean => open[key] === true
    if (!LOG.on) return flattenAxis(axis, isOpen)
    const started = performance.now()
    const built = flattenAxis(axis, isOpen)
    LOG.emit(CAT_FLATTEN, "flatten {id} {durationMs}ms", {
      id: loggedId,
      count: built.length,
      durationMs: performance.now() - started,
    })
    return built
  })

  const NO_ORDER = (): null => null

  /**
   * The ordering the column axis takes when it is the vertical one. Each sort item carries a bare
   * column of its own, because the values on this axis are the schema, so there is no second
   * schema to look the field up in.
   */
  const colOrdering = (): ((a: ColumnDef<TRow>, b: ColumnDef<TRow>) => number) | null => {
    if (mode === "server") return null
    const model = state.sort.$()
    return buildComparator<ColumnDef<TRow>>(
      model,
      model.map((it) => ({ id: it.field })),
      (def, field) => (def as unknown as Record<string, unknown>)[field],
    )
  }

  /**
   * The column axis: hidden columns dropped, `colOrder` applied, header groups turned into parent
   * edges. Then the same vertical ordering `sorted` runs, because a sort item names a field and
   * each axis reads that field off its own values: a row object when rows stand vertical, a
   * `ColumnDef` when columns do. The seat table decides which of the two ever sees the model.
   * @feature col.visible
   */
  const colAxis = Signal<Axis<ColId, ColumnDef<TRow>>>(() => {
    const defs = columns.$()
    const hidden = state.colHidden.$()
    const order = state.colOrder.$()
    const visible = defs.filter((it) => hidden[it.id] !== true)
    const rank = new Map(order.map((key, index) => [key, index] as const))
    const ordered = [...visible].sort(
      (a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    )
    const axis = axisOfEntries(
      ordered.map((it) => [it.id, it] as const),
      (_key, value) => value.group,
    )
    return sortAxis(axis, verticalOf([NO_ORDER, colOrdering], state.orientation.$())())
  })

  const colNodes = Signal<readonly FlatNode<ColId>[]>(() => flattenAxis(colAxis.$(), () => true))

  // Seat 0 is the row axis and seat 1 the column axis, always, in every pair in this file. Which
  // one scrolls is `12_transpose.ts`'s answer and nothing here is allowed to have an opinion.
  const seats: FacetPair<string, unknown> = [
    () => ({
      axis: detailed.$(),
      nodes: flat.$(),
      pinning: state.rowPinning.$(),
      extent: state.rowHeight.$(),
    }),
    () => ({
      axis: colAxis.$(),
      nodes: colNodes.$(),
      pinning: state.colPinning.$(),
      extent: state.colWidth.$(),
    }),
  ]

  const vertical = Signal<AxisFacet<string, unknown>>(() =>
    verticalFacet(seats, state.orientation.$()),
  )
  const horizontal = Signal<AxisFacet<string, unknown>>(() =>
    horizontalFacet(seats, state.orientation.$()),
  )

  const plan = Signal<RenderPlan<RowId>>(() => {
    const seat = vertical.$()
    // The direction supplies the fallback, not the axis: a column standing on the y dimension is
    // one row height tall, because that is what the density setting is measuring.
    const fallback = ROW_HEIGHT[state.density.$()]
    // The two fields by name, so a sideways scroll writes `left` and never wakes this stage. Reading
    // the whole viewport put a full row replan on every horizontal frame.
    const start = viewport.top.$()
    const extent = viewport.height.$()
    const args = pageWindow(state.page.$())
    const input: RenderPlanInput<string> = {
      flat: seat.nodes.map((it) => it.key),
      side: (key) => seat.pinning[key],
      page: args.page,
      // Server mode already answered with exactly the page it was asked for, so slicing here takes
      // `[index * size, ...)` of a list that starts at row 0 and renders nothing from page 1 on.
      // `infinite` happens to agree, because the caller returns the whole `[0, loaded)` prefix;
      // `pages` does not, and the two modes must not disagree about who did the cut.
      paginate: mode === "client" && args.enabled,
      virtualize: state.virtualize.vertical.$(),
      sizer: (keys) => sizerFor(keys, (it) => seat.extent[it], fallback),
      viewport: { start, extent },
      overscan: config.overscan ?? 4,
    }
    if (!LOG.on) return renderPlan(input)
    const started = performance.now()
    const built = renderPlan(input)
    LOG.emit(CAT_PLAN, "plan {id} {durationMs}ms", {
      id: loggedId,
      count: input.flat.length,
      drawn: built.start.length + built.center.length + built.end.length,
      durationMs: performance.now() - started,
    })
    return built
  })

  /** @feature view.list */
  const cols = Signal<readonly FlatNode<ColId>[]>(() =>
    collapseToOneEntry(horizontal.$().nodes, state.listView.$()),
  )

  /**
   * Declared widths, not resolved ones. The browser owns distribution now: `trackList` emits `fr`
   * and `minmax()` into `grid-template-columns`, so nothing here can know what a flex column
   * ends up occupying without measuring the DOM. A flex column therefore reports the default,
   * and a caller wanting the painted width reads the element.
   */
  const widths = Signal<ReadonlyMap<ColId, number>>(() => {
    const defs = byId.$()
    const override = state.colWidth.$()
    // The column axis rather than the horizontal run: a width is column geometry, and under the
    // transpose the horizontal run holds rows, which have no width to resolve.
    const declared = new Map<ColId, number>()
    for (const node of colNodes.$()) {
      const col = defs.get(node.key)
      if (col === undefined) continue
      declared.set(col.id, override[col.id] ?? col.width ?? DEFAULT_COL_WIDTH)
    }
    return declared
  })

  /** The horizontal run's entries with the bands dropped. A node the axis holds no value for is a
   * band over its leaves and occupies no seat, which is one test under either seating. */
  const colLeaves = Signal<readonly ColId[]>(() => {
    const across = horizontal.$()
    return cols.$().filter((it) => across.axis.by.has(it.key)).map((it) => it.key)
  })

  /** The same `renderPlan` the vertical seat runs, handed the other viewport dimension. `partition`
   * lifts pinned entries out first, so the window can never drop one. @feature view.virtualize.col */
  const colPlan = Signal<RenderPlan<ColId>>(() => {
    const seat = horizontal.$()
    // The mirror of the row plan's read: a downward scroll writes `top` and leaves this window alone.
    const start = viewport.left.$()
    const extent = viewport.width.$()
    const resolved = widths.$()
    return renderPlan<ColId>({
      flat: colLeaves.$(),
      side: (key) => seat.pinning[key],
      page: NO_PAGE,
      paginate: false,
      virtualize: state.virtualize.horizontal.$(),
      // A resolved column width first, the seat's own override second: under the transpose this run
      // holds rows, which have no entry in a map keyed by column, so the chain falls through.
      sizer: (keys) => sizerFor(keys, (it) => resolved.get(it) ?? seat.extent[it], DEFAULT_COL_WIDTH),
      viewport: { start, extent },
      overscan: config.overscan ?? 4,
    })
  })

  const colSpacers = Signal<Spacers>(() => spacersOf(colPlan.$()))

  /**
   * `ColumnDef.span` is the source; this relation is what the kernel reads. The callback is
   * column-shaped and could not survive a transpose, so it is crossed into vertical/horizontal
   * counts once, here, and never spoken of in row and column terms again.
   * @feature cell.span
   */
  const spans = Signal<SpanRelation>(() => {
    const spanning = columns.$().filter((it) => it.span !== undefined)
    // Nothing declares a span in the overwhelming case. Bailing before the row reads is what keeps
    // this stage off the dependency list of every grid that never asked for one.
    if (spanning.length === 0) return NO_SPANS
    const orientation = state.orientation.$()
    const by = detailed.$().by
    const out = new Map<CellId, CellSpan>()
    for (const node of flat.$()) {
      const row = by.get(node.key)
      if (row === undefined) continue
      for (const def of spanning) {
        const read = def.span
        if (read === undefined) continue
        const declared = read(row, node.index)
        if (declared === undefined) continue
        const extent = neutralSpan(declared, orientation)
        // A span of one in both directions is a plain cell, and an anchor that covers nothing
        // would still cost the covered walk a lookup.
        if (extent.vertical <= 1 && extent.horizontal <= 1) continue
        out.set(neutralCell(node.key, def.id, orientation), extent)
      }
    }
    return out
  })

  const covered = Signal<ReadonlySet<CellId>>(() => {
    const relation = spans.$()
    if (relation.size === 0) return NO_COVER
    return coveredBy(
      relation,
      vertical.$().nodes.map((it) => it.key),
      horizontal.$().nodes.map((it) => it.key),
    )
  })

  const view: GridView<TRow> = {
    base,
    grouped,
    sorted,
    detailed,
    flat,
    vertical,
    horizontal,
    plan,
    cols,
    colLeaves,
    colPlan,
    colSpacers,
    widths,
    spans,
    covered,
  }

  const query = Signal<QueryDescriptor>(() => ({
    sort: state.sort.$(),
    group: state.group.$(),
    page: { ...state.page.$(), total: rowCount.$() },
    expand: null,
  }))

  return {
    id,
    mode,
    state,
    rows,
    columns,
    view,
    viewport,
    actions$,
    intent$: byPhase<TRow, "intent">(actions$, "intent"),
    change$: byPhase<TRow, "change">(actions$, "change"),
    effect$: byPhase<TRow, "effect">(actions$, "effect"),
    query,
    page$: actions$.pipe(
      rxFilter((it): it is Extract<GridChange, { type: "page" }> => it.phase === "change" && it.type === "page"),
      map((it): PageRequest => ({ index: it.page.index, size: it.page.size })),
      share(),
    ),
    dispatch,
    bind: (root) => bindRoot(root, id, dispatch, slice.epics$),
    close: () => opened.unsubscribe(),
    epics$: slice.epics$,
    slots: config.slots ?? {},
    rowId: config.rowId,
  }
}

// A run with no per-entry extent override is the uniform case, which is O(1) per lookup and the
// reason variable sizing is opt-in rather than the default.
// Keyed by position in `keys`, which is the page run renderPlan is about to window, not the flat
// list. Taking the keys rather than a count is what removes the index translation: pinning lifts
// entries out and paging drops others, so a flat-list index named a different entry than the
// sizer read. A lookup rather than a record: a second sizer builder is a second windowing path.
function sizerFor(
  keys: readonly string[],
  extentOf: (key: string) => number | undefined,
  fallback: number,
): Sizer {
  const measured = new Map<number, number>()
  for (let index = 0; index < keys.length; index++) {
    const key = keys[index]
    if (key === undefined) continue
    const extent = extentOf(key)
    if (extent !== undefined) measured.set(index, extent)
  }
  if (measured.size === 0) return uniformSizer(keys.length, fallback)
  return measuredSizer(keys.length, fallback, measured)
}

// --- Binding ----------------------------------------------------------------

type Routed = { readonly delegateElement: HTMLElement; readonly params: { readonly gridId: string } }

/** True when the event's path from target to root (exclusive) crosses another grid's boundary, so a
 * key raised inside a nested grid stays that grid's. The root itself is a boundary and is excluded. */
function nestedBoundaryBetween(root: HTMLElement, target: EventTarget | null): boolean {
  let node: Node | null = target instanceof Node ? target : null
  while (node !== null && node !== root) {
    if (node instanceof HTMLElement && node.hasAttribute(ROUTE_BOUNDARY_ATTR)) return true
    node = node.parentNode
  }
  return false
}

// One table, one subscription per row. `Dom` delegates per template for the whole page, so both
// the gridId param and the root are checked: two grids share every listener.
function bindRoot<TRow>(
  root: HTMLElement,
  id: Signal<string>,
  dispatch: (action: GridAction<TRow>) => void,
  epics$: Observable<never>,
): () => void {
  const dom = gridDom(id.$())
  const subs = new Subscription()
  const on = <E extends Routed>(source: Observable<E>, to: (event: E) => GridIntent): void => {
    subs.add(
      source
        .pipe(rxFilter((it) => it.params.gridId === id.$() && root.contains(it.delegateElement)))
        .subscribe((it) => dispatch(to(it))),
    )
  }
  on(dom.cell.route.click, intentOf["cell.click"])
  on(dom.cell.route.pointerdown, intentOf["cell.pointerdown"])
  // `pointerenter` does not bubble, and delegation listens on the document, so the hover edge
  // arrives as `pointerover` and the route resolves it to the cell underneath.
  on(dom.cell.route.pointerover, intentOf["cell.pointerenter"])
  on(dom.cell.route.dblclick, intentOf["cell.dblclick"])
  on(dom.header.route.click, intentOf["header.click"])
  on(dom.headerResize.route.pointerdown, (it) => intentOf["header.pointerdown"](it, "resize"))
  on(dom.headerMove.route.pointerdown, (it) => intentOf["header.pointerdown"](it, "move"))
  // The header body, which is every part of it the move label and the resize handle do not cover.
  on(dom.header.route.pointerdown, (it) => intentOf["header.pointerdown"](it, "select"))
  on(dom.rowMove.route.pointerdown, intentOf["row.pointerdown"])
  on(dom.expander.route.click, intentOf["expander.click"])
  // Two seats for one glyph: `expandColumn()` renders a routeless cell, and the run expander sits
  // inside the first routed one, so the two chains differ by a `c` segment and never both fire.
  on(dom.cellExpander.route.click, intentOf["expander.click"])
  on(dom.rowCheck.route.click, intentOf["checkbox.click"])
  // No route: a key event has no part under it, and focus sits on the grid box itself.
  // A key raised inside a nested grid still bubbles to this root, and both grids would move. The
  // nested grid's own root carries `data-route-boundary`, so a key whose path passes through one
  // belongs to the inner grid and this handler steps out of the way.
  subs.add(
    fromEvent<KeyboardEvent>(root, "keydown")
      .pipe(rxFilter((it) => !nestedBoundaryBetween(root, it.target)))
      .subscribe((it) => dispatch(intentOf.key(it))),
  )
  // Epics are cold. Without this the intents above reduce nothing.
  subs.add(epics$.subscribe())
  return () => subs.unsubscribe()
}
