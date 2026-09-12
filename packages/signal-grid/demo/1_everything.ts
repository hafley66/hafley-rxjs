// Route 1. Every feature the kernel implements, switched on at once, over 50,000 rows.
// The one that is meant to break first.
import { Signal } from "@hafley66/signals"
import { merge, skip, Subscription, tap } from "rxjs"
import { mountInView, runWhenInView } from "@hafley66/docs-kit"
import { checkboxColumn, compositeColumn, defaultState, grid, isGroupKey, moveAttrs, pinningFor, render, ROW_HEIGHT, rowNumberColumn, type CellCtx, type ColId, type ColumnDef, type Grid, type GridState, type HeaderCtx, type PageMode, type Renderable, type RowId, type Side, type Viewport } from "../src/index.js"
import {
  actions,
  applyOrder,
  attributeOf,
  checkField,
  group,
  h,
  lens,
  moveBefore,
  numberField,
  rangeField,
  readbackField,
  segmentField,
  selectField,
  textField,
  type Option,
  type Reorderable,
} from "./controls.js"
import { formatDate, formatSize, leaves, tree, type FsRow } from "./data.js"
import { readout } from "./readout.js"
import { SCENARIOS, type DataShape } from "./scenarios.js"
import { aboutPanel, stageBox, type DemoHandle, type DemoHosts, type DemoRoute } from "./0_shell.js"

// --- Schema -----------------------------------------------------------------

/** The band a header group hangs the three metadata columns under. */
const META_GROUP = "grp-meta"

const DATA_COLUMNS: readonly ColumnDef<FsRow>[] = [
  { id: "name", header: "Name", type: "string", flex: 2, minWidth: 220, resizable: true },
  { id: "size", header: "Size", type: "number", width: 110, resizable: true },
  { id: "kind", header: "Kind", type: "string", width: 130, resizable: true, groupable: true },
  { id: "modified", header: "Modified", type: "date", width: 130, resizable: true },
  { id: "owner", header: "Owner", type: "string", flex: 1, minWidth: 110, resizable: true, groupable: true },
]

const COLUMN_IDS: readonly ColId[] = DATA_COLUMNS.map((it) => it.id)
const GROUPABLE: readonly ColId[] = DATA_COLUMNS.filter((it) => it.groupable === true).map((it) => it.id)

const BANDED: readonly ColumnDef<FsRow>[] = [
  { id: META_GROUP, header: "Metadata" },
  ...DATA_COLUMNS.map((it) =>
    it.id === "kind" || it.id === "modified" || it.id === "owner" ? { ...it, group: META_GROUP } : it,
  ),
]

const groupLabel = (data: FsRow): string => {
  const path = (data as unknown as { readonly path?: readonly unknown[] }).path
  const last = path === undefined ? undefined : path[path.length - 1]
  return last === undefined || last === "" ? "(none)" : String(last)
}

// --- The route --------------------------------------------------------------

export const everythingDemo: DemoRoute = {
  slug: "everything",
  title: "Everything table",
  blurb:
    "50,000 rows with multi-sort, grouping, both pinnings, drag reorder and resize, built-in glyph " +
    "columns, a composite cell, paging, virtualization, density and keyboard nav all live at once.",
  stressing:
    "Every implemented feature switched on together, so a stage that only works alone shows up as " +
    "a torn frame rather than as a passing unit test.",
  features: [
    "row.sort",
    "row.sort.multi",
    "row.group",
    "row.tree",
    "row.expand",
    "row.select",
    "row.pin",
    "row.height",
    "col.visible",
    "col.order",
    "col.pin",
    "col.resize",
    "col.size",
    "col.group",
    "cell.focus",
    "cell.select",
    "page.paginate",
    "page.infinite",
    "view.virtualize.row",
    "view.scroll",
    "view.density",
    "view.list",
    "view.slots",
    "view.theme",
  ],
  defects: [
    "ColumnDef.pin never seeds colPinning: this route calls pinningFor() itself.",
    "ColumnDef.movable is read by the renderer but absent from the type, so the move grip is stamped by a header slot.",
  ],
  // The stage is the gate for everything the route opens, so `mount` names the host once and every
  // `runWhenInView` below it carries a source alone.
  mount: (hosts) => mountInView(hosts.stage, () => mount(hosts)),
}

function mount(hosts: DemoHosts): DemoHandle {
  const subs = new Subscription()
  const box = stageBox(hosts, "stage-box")

  const shape = Signal<DataShape>("flat")
  const banded = Signal<boolean>(false)
  const rows = Signal<readonly FsRow[]>(() => (shape.$() === "tree" ? tree() : leaves()))

  let live: Grid<FsRow> | undefined

  const cellSlot = (ctx: CellCtx<FsRow>): Renderable => {
    if (isGroupKey(ctx.row)) {
      if (ctx.col !== "name") return ""
      const count = live?.view.sorted.$().children.get(ctx.row)?.length ?? 0
      const el = h("span", "cell-group")
      el.append(groupLabel(ctx.data), h("span", "cell-count", count.toLocaleString("en-US")))
      return el
    }
    if (ctx.col === "size") return formatSize(ctx.value)
    if (ctx.col === "modified") return formatDate(ctx.value)
    if (ctx.col === "name") {
      const el = h("span", "cell-name")
      const folder = ctx.node.hasChildren || ctx.data.kind === "folder"
      el.append(h("span", "cell-icon", folder ? "■" : "▫"), String(ctx.value ?? ""))
      return el
    }
    return String(ctx.value ?? "")
  }

  // The renderer only stamps a move route when `def.movable` is true, and `ColumnDef` has no such
  // key, so the grip is stamped here instead.
  const headerSlot = (ctx: HeaderCtx<FsRow>): Renderable => {
    const handle = h("span", "head-grip", "⁙")
    for (const [name, value] of Object.entries(moveAttrs())) handle.setAttribute(name, value)
    const def = BANDED.find((it) => it.id === ctx.col)
    return [handle, h("span", "head-label", def?.header ?? ctx.col)]
  }

  const schema = Signal<readonly ColumnDef<FsRow>[]>(() => [
    checkboxColumn<FsRow>({ grid: () => live }),
    rowNumberColumn<FsRow>({ grid: () => live }),
    ...(banded.$() ? BANDED : DATA_COLUMNS),
    compositeColumn<FsRow>({
      id: "who",
      header: "Owner / kind",
      parts: ["owner", "kind"],
      columns: () => DATA_COLUMNS,
      width: 150,
    }),
  ])

  const seedBox = box.getBoundingClientRect()
  const viewport = Signal<Viewport>({
    top: 0,
    left: 0,
    width: Math.round(seedBox.width),
    height: Math.round(seedBox.height),
  })

  const seedPinning = pinningFor(schema.$())

  const files = grid<FsRow>({
    id: "everything",
    rows,
    columns: schema,
    rowId: (it) => it.id,
    subRows: (it) => it.children,
    state: Signal<Partial<GridState>>({ virtualize: { vertical: true, horizontal: false }, colPinning: { ...seedPinning } }),
    viewport,
    overscan: 6,
    slots: { cell: cellSlot, header: headerSlot },
  })
  live = files

  const handle = render(files, box)
  const scroll = box.querySelector(".sg-scroll")

  const resetScroll = (): void => {
    if (!(scroll instanceof HTMLElement)) return
    scroll.scrollTop = 0
    scroll.scrollLeft = 0
  }

  box.addEventListener("keydown", (event) => {
    if (event.key.startsWith("Arrow") || event.key === " ") event.preventDefault()
  })

  // --- lenses ---------------------------------------------------------------

  const multiSort = Signal<boolean>(true)
  const pinTarget = Signal<string>("")

  const sortOf = (field: ColId): "off" | "asc" | "desc" =>
    files.state.sort.$().find((it) => it.field === field)?.sort ?? "off"

  const setSort = (field: ColId, next: "off" | "asc" | "desc", multi: boolean): void => {
    const rest = files.state.sort.$().filter((it) => it.field !== field)
    if (next === "off") {
      files.state.sort.$(rest)
      return
    }
    files.state.sort.$(multi ? [...rest, { field, sort: next }] : [{ field, sort: next }])
  }

  const setGroup = (field: ColId, on: boolean): void => {
    const current = files.state.group.$()
    if (on === current.includes(field)) return
    files.state.group.$(on ? [...current, field] : current.filter((it) => it !== field))
  }

  const setPinning = (field: ColId, side: Side | "none"): void => {
    const next = { ...files.state.colPinning.$() }
    if (side === "none") delete next[field]
    else next[field] = side
    files.state.colPinning.$(next)
  }

  const setHidden = (field: ColId, visible: boolean): void => {
    const next = { ...files.state.colHidden.$() }
    if (visible) delete next[field]
    else next[field] = true
    files.state.colHidden.$(next)
  }

  const widthOf = (field: ColId): number =>
    files.state.colWidth.$()[field] ?? files.view.widths.$().get(field) ?? 100

  const setWidth = (field: ColId, width: number): void => {
    files.state.colWidth.$({ ...files.state.colWidth.$(), [field]: width })
  }

  const columnOrder = (): readonly ColId[] => {
    const rank = new Map(files.state.colOrder.$().map((id, at) => [id, at] as const))
    return [...COLUMN_IDS].sort(
      (left, right) =>
        (rank.get(left) ?? Number.MAX_SAFE_INTEGER) - (rank.get(right) ?? Number.MAX_SAFE_INTEGER),
    )
  }

  const setPage = (patch: Partial<{ mode: PageMode; index: number; size: number }>): void => {
    files.state.page.$({ ...files.state.page.$(), ...patch })
  }

  const openAllKeys = (): void => {
    const next: Record<RowId, boolean> = {}
    for (const key of files.view.sorted.$().children.keys()) next[key] = true
    files.state.expanded.$(next)
  }

  const setRowPin = (side: Side | "none"): void => {
    const id = pinTarget.$()
    if (id === "") return
    const next = { ...files.state.rowPinning.$() }
    if (side === "none") delete next[id]
    else next[id] = side
    files.state.rowPinning.$(next)
  }

  const selectRendered = (): void => {
    const next = { ...files.state.rowSelection.$() }
    for (const key of files.view.plan.$().center) next[key] = true
    files.state.rowSelection.$(next)
  }

  const describeSort = (): string => {
    const model = files.state.sort.$()
    return model.length === 0 ? "none" : model.map((it) => `${it.field} ${it.sort}`).join(", ")
  }

  const describeGroup = (): string => {
    const keys = files.state.group.$()
    return keys.length === 0 ? "no grouping" : keys.join(" → ")
  }

  const describeSelection = (): string => {
    const selection = files.state.rowSelection.$()
    let on = 0
    for (const key of Object.keys(selection)) if (selection[key] === true) on++
    return `${on.toLocaleString("en-US")} rows`
  }

  // --- panel ----------------------------------------------------------------

  const SIDE_OPTIONS: readonly Option<Side | "none">[] = [
    { value: "start", label: "S" },
    { value: "none", label: "·" },
    { value: "end", label: "E" },
  ]

  const SORT_OPTIONS: readonly Option<"off" | "asc" | "desc">[] = [
    { value: "off", label: "·" },
    { value: "asc", label: "↑" },
    { value: "desc", label: "↓" },
  ]

  const scenarioBox = h("div", "scenarios")
  const activeScenario = Signal<string>("")
  const applyScenario = (name: string): void => {
    const scenario = SCENARIOS.find((it) => it.name === name)
    if (scenario === undefined) return
    if (scenario.shape !== undefined) shape.$(scenario.shape)
    const next = defaultState(scenario.state)
    files.state.$({ ...next, colPinning: { ...seedPinning, ...next.colPinning } })
    resetScroll()
    activeScenario.$(name)
  }
  for (const scenario of SCENARIOS) {
    const button = h("button", "scenario", scenario.name)
    button.type = "button"
    button.title = scenario.description
    button.addEventListener("click", () => applyScenario(scenario.name))
    scenarioBox.append(button)
  }

  const scenarioGroup = group("Scenarios", [
    attributeOf(scenarioBox, "data-active", activeScenario),
    selectField<DataShape>(
      "data shape",
      [
        { value: "flat", label: "flat (50,000 leaves)" },
        { value: "tree", label: "tree (6 roots, 50,636 nodes)" },
      ],
      shape,
    ),
  ])

  const rowGroup = group("Row axis", [
    readbackField("sort model", Signal<string>(describeSort)),
    checkField("multi-column sort (shift-click a header does this too)", multiSort),
    actions([
      { label: "clear sort", run: () => files.state.sort.$([]) },
      { label: "expand all", run: openAllKeys },
      { label: "collapse all", run: () => files.state.expanded.$({}) },
      { label: "select page", run: selectRendered },
      { label: "clear selection", run: () => files.state.rowSelection.$({}) },
    ]),
    readbackField("group model", Signal<string>(describeGroup)),
    ...GROUPABLE.map((field) =>
      checkField(
        `group by ${field}`,
        lens(
          () => files.state.group.$().includes(field),
          (on) => setGroup(field, on),
        ),
      ),
    ),
    readbackField("row selection", Signal<string>(describeSelection)),
    textField("pin row (id)", pinTarget, "/workspace/src-0"),
    segmentField<Side | "none">(
      "pinned side",
      SIDE_OPTIONS,
      lens(() => files.state.rowPinning.$()[pinTarget.$()] ?? "none", setRowPin),
    ),
    actions([
      { label: "take first rendered row", run: () => pinTarget.$(files.view.plan.$().center[0] ?? "") },
      { label: "unpin all rows", run: () => files.state.rowPinning.$({}) },
    ]),
    selectField<PageMode>(
      "page mode",
      [
        { value: "all", label: "all" },
        { value: "pages", label: "pages" },
        { value: "infinite", label: "infinite" },
      ],
      lens(() => files.state.page.mode.$(), (mode) => setPage({ mode, index: 0 })),
    ),
    numberField("page size", { min: 5, max: 5000, step: 5 }, files.state.page.size),
    numberField("page index", { min: 0, max: 100000, step: 1 }, files.state.page.index),
    actions([
      { label: "prev page", run: () => setPage({ index: Math.max(0, files.state.page.$().index - 1) }) },
      { label: "next page", run: () => setPage({ index: files.state.page.$().index + 1 }) },
    ]),
  ])

  const columnList = h("div", "columns")
  let dragging: ColId | null = null

  const nudgeColumn = (field: ColId, delta: number): void => {
    const order = columnOrder()
    const at = order.indexOf(field)
    const to = at + delta
    if (at === -1 || to < 0 || to >= order.length) return
    files.state.colOrder.$(moveBefore(order, field, delta < 0 ? order[to] ?? null : order[to + 1] ?? null))
  }

  const columnCard = (field: ColId): Reorderable => {
    const def = DATA_COLUMNS.find((it) => it.id === field)
    const el = h("div", "column-card")
    el.draggable = true
    el.dataset["col"] = field

    const head = h("div", "column-head")
    const grip = h("span", "grip", "⁙")
    const visible = checkField(
      def?.header ?? field,
      lens(() => files.state.colHidden.$()[field] !== true, (on) => setHidden(field, on)),
    )
    const up = h("button", "icon-button", "↑")
    const down = h("button", "icon-button", "↓")
    up.type = "button"
    down.type = "button"
    up.title = "move earlier"
    down.title = "move later"
    up.addEventListener("click", () => nudgeColumn(field, -1))
    down.addEventListener("click", () => nudgeColumn(field, 1))
    head.append(grip, visible.el, up, down)

    const sort = segmentField<"off" | "asc" | "desc">(
      "sort",
      SORT_OPTIONS,
      lens(() => sortOf(field), (next) => setSort(field, next, multiSort.$())),
    )
    const pin = segmentField<Side | "none">(
      "pin",
      SIDE_OPTIONS,
      lens(() => files.state.colPinning.$()[field] ?? "none", (side) => setPinning(field, side)),
    )
    const width = rangeField(
      "width",
      { min: 60, max: 640, step: 4 },
      lens(() => Math.round(widthOf(field)), (next) => setWidth(field, next)),
      (it) => `${it}px`,
    )

    el.append(head, sort.el, pin.el, width.el)

    el.addEventListener("dragstart", (event) => {
      dragging = field
      el.setAttribute("data-dragging", "true")
      event.dataTransfer?.setData("text/plain", field)
    })
    el.addEventListener("dragend", () => {
      dragging = null
      el.removeAttribute("data-dragging")
    })
    el.addEventListener("dragover", (event) => {
      if (dragging === null || dragging === field) return
      event.preventDefault()
      el.setAttribute("data-drop", "true")
    })
    el.addEventListener("dragleave", () => el.removeAttribute("data-drop"))
    el.addEventListener("drop", (event) => {
      event.preventDefault()
      el.removeAttribute("data-drop")
      if (dragging === null || dragging === field) return
      files.state.colOrder.$(moveBefore(columnOrder(), dragging, field))
    })

    const hidden = attributeOf(
      el,
      "data-hidden",
      Signal<string>(() => String(files.state.colHidden.$()[field] === true)),
    )

    return {
      key: field,
      el,
      bind$: merge(visible.bind$, sort.bind$, pin.bind$, width.bind$, hidden.bind$),
    }
  }

  const cards = COLUMN_IDS.map(columnCard)
  for (const card of cards) columnList.append(card.el)

  const columnGroup = group("Column axis", [
    {
      el: columnList,
      bind$: merge(
        Signal<readonly ColId[]>(columnOrder).$.pipe(
          tap((order) => applyOrder(columnList, order, cards)),
        ),
        ...cards.map((it) => it.bind$),
      ),
    },
    actions([
      { label: "reset order", run: () => files.state.colOrder.$([]) },
      { label: "reset widths", run: () => files.state.colWidth.$({}) },
      { label: "unpin all", run: () => files.state.colPinning.$({ ...seedPinning }) },
      { label: "show all", run: () => files.state.colHidden.$({}) },
    ]),
    checkField("header groups (kind, modified, owner under Metadata)", banded),
    readbackField(
      "column axis nodes",
      Signal<string>(() => {
        const nodes = files.view.horizontal.$().nodes.length
        const tracks = files.view.cols.$().length
        return `${nodes} nodes, ${tracks} in run`
      }),
    ),
  ])

  const setRowHeight = (next: number): void => {
    ROW_HEIGHT[files.state.density.$()] = next
    files.state.density.$(files.state.density.$())
  }

  const logScroll = Signal<boolean>(false)

  const viewGroup = group("View", [
    segmentField<GridState["density"]>(
      "density",
      [
        { value: "compact", label: "compact" },
        { value: "standard", label: "standard" },
        { value: "comfortable", label: "roomy" },
      ],
      files.state.density,
    ),
    checkField("virtualize rows", files.state.virtualize.vertical),
    checkField("list view", files.state.listView),
    rangeField(
      "--sg-row-h",
      { min: 20, max: 72, step: 1 },
      lens(() => ROW_HEIGHT[files.state.density.$()], setRowHeight),
      (it) => `${it}px`,
    ),
    checkField("log viewport.scroll intents", logScroll),
  ])

  hosts.panel.append(aboutPanel(everythingDemo), scenarioGroup.el, rowGroup.el, columnGroup.el, viewGroup.el)

  const panelReadout = readout(files, box, logScroll)
  hosts.readout.append(panelReadout.el)

  subs.add(
    runWhenInView(
      merge(
        scenarioGroup.bind$,
        rowGroup.bind$,
        columnGroup.bind$,
        viewGroup.bind$,
        // The seeded value is the scroll position the reader already has, so only a later choice
        // of shape sends the stage back to the top.
        shape.$.pipe(skip(1), tap(() => resetScroll())),
        files.state.listView.$.pipe(
          tap((it) => hosts.shell.setAttribute("data-list-view", String(it))),
        ),
      ),
    ),
  )

  window.__demo = {
    shape,
    applyScenario,
    expandAll: openAllKeys,
    rowCount: () => box.getElementsByClassName("sg-row").length,
  }

  return {
    grid: files,
    stop: () => {
      subs.unsubscribe()
      panelReadout.stop()
      handle.stop()
      files.close()
      live = undefined
      box.remove()
      hosts.shell.removeAttribute("data-list-view")
    },
  }
}
