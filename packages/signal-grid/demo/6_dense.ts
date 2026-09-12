// Route 6. Windowing when a row is expensive to build, rather than when there are many cheap ones:
// nine slot columns, SVG in four of them, a nested table in one, a few hundred elements per row.
import { Signal } from "@hafley66/signals"
import { merge, Subscription } from "rxjs"
import { mountInView, runWhenInView } from "@hafley66/docs-kit"
import {
  checkboxColumn,
  defaultEpics,
  dragColumn,
  grid,
  render,
  ROW_HEIGHT,
  rowNumberColumn,
  selectRowsOnCellClick,
  type CellCtx,
  type ColumnDef,
  type Grid,
  type GridState,
  type Renderable,
  type RowId,
  type Viewport,
} from "../src/index.js"
import {
  actions,
  afterPaint,
  checkField,
  group,
  h,
  paintedText,
  readbackField,
  segmentField,
  type Bound,
} from "./controls.js"
import { readout } from "./readout.js"
import { aboutPanel, stageBox, type DemoHandle, type DemoHosts, type DemoRoute } from "./0_shell.js"

// --- The relation -----------------------------------------------------------

export const ROW_COUNT = 20_000

/** Tall enough for a sparkline and a four-line nested table to both be legible. */
const ROW_PX = 96

const SERIES = 32
const BARS = 28
const STEPS = 5

export interface DenseRow {
  readonly id: RowId
  readonly at: number
  readonly name: string
  readonly team: string
  readonly region: string
  readonly health: number
  readonly note: string
}

const TEAMS = ["kernel", "render", "ingest", "billing", "search", "identity"] as const
const REGIONS = ["us-east", "us-west", "eu-central", "ap-south", "sa-east"] as const
const WORDS = [
  "retry", "backfill", "shard", "rollout", "quota", "cutover", "replay", "drain", "warm", "seed",
] as const

// One integer hash, so every number this route draws is a function of the row index and the column
// rather than a value stored per row. 20,000 rows cost 20,000 small objects and nothing else.
const hash = (a: number, b: number): number => {
  let x = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x165667b1, 0xc2b2ae35)
  x ^= x >>> 15
  x = Math.imul(x, 0x2545f491)
  return ((x ^ (x >>> 13)) >>> 0) / 4_294_967_296
}

const pick = <T>(list: readonly T[], at: number, salt: number): T =>
  list[Math.floor(hash(at, salt) * list.length)] as T

const seriesOf = (at: number, salt: number, count: number): readonly number[] =>
  Array.from({ length: count }, (_value, index) => hash(at * 97 + index, salt))

const noteOf = (at: number): string =>
  `${pick(WORDS, at, 11)} ${pick(WORDS, at, 12)} ${pick(WORDS, at, 13)} for ${pick(REGIONS, at, 14)} ` +
  `after the ${pick(WORDS, at, 15)} window closed`

const rowAt = (at: number): DenseRow => ({
  id: `n${at}`,
  at,
  name: `${pick(TEAMS, at, 1)}-${pick(WORDS, at, 2)}-${String(at).padStart(5, "0")}`,
  team: pick(TEAMS, at, 3),
  region: pick(REGIONS, at, 4),
  health: hash(at, 5),
  note: noteOf(at),
})

/** Built once and frozen, so a scroll never changes the identity the renderer rebuilds a row on. */
export const ROWS: readonly DenseRow[] = Array.from({ length: ROW_COUNT }, (_value, at) => rowAt(at))

// --- Element helpers --------------------------------------------------------

const NS = "http://www.w3.org/2000/svg"

const svg = <K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Readonly<Record<string, string | number>>,
): SVGElementTagNameMap[K] => {
  const node = document.createElementNS(NS, tag)
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value))
  return node
}

const chip = (className: string, text: string): HTMLElement => h("span", className, text)

// --- The nine cells ---------------------------------------------------------

/** Avatar, name, two badges, and a note the cell truncates and the title attribute carries whole. */
const whoCell = (ctx: CellCtx<DenseRow>): Renderable => {
  const row = ctx.data
  const host = h("div", "dz-who")
  const face = svg("svg", { viewBox: "0 0 32 32", class: "dz-avatar", "aria-hidden": "true" })
  face.append(
    svg("circle", { cx: 16, cy: 16, r: 15, class: "dz-avatar-disc" }),
    svg("circle", { cx: 16, cy: 12, r: 5, class: "dz-avatar-head" }),
    svg("path", { d: "M4 31c2-8 7-11 12-11s10 3 12 11", class: "dz-avatar-body" }),
  )
  const stack = h("div", "dz-who-lines")
  const top = h("div", "dz-who-top")
  top.append(
    h("span", "dz-name", row.name),
    chip("dz-badge dz-badge-team", row.team),
    chip("dz-badge dz-badge-region", row.region),
  )
  const note = h("span", "dz-note", row.note)
  note.title = row.note
  stack.append(top, note)
  host.append(face, stack)
  return host
}

/** An area, a line, a baseline, and one dot per sample. The dots are the expensive half on purpose. */
const trendCell = (ctx: CellCtx<DenseRow>): Renderable => {
  const points = seriesOf(ctx.data.at, 21, SERIES)
  const chart = svg("svg", { viewBox: `0 0 ${SERIES - 1} 20`, class: "dz-spark", preserveAspectRatio: "none" })
  const step = (value: number): number => 19 - value * 18
  const line = points.map((value, index) => `${index},${step(value).toFixed(2)}`).join(" ")
  chart.append(
    svg("polygon", { points: `0,20 ${line} ${SERIES - 1},20`, class: "dz-spark-area" }),
    svg("polyline", { points: line, class: "dz-spark-line" }),
    svg("line", { x1: 0, y1: 10, x2: SERIES - 1, y2: 10, class: "dz-spark-mid" }),
  )
  for (const [index, value] of points.entries()) {
    chart.append(svg("circle", { cx: index, cy: step(value).toFixed(2), r: 0.5, class: "dz-spark-dot" }))
  }
  return chart
}

/** One rect per bucket, coloured by which third of the range it lands in. */
const loadCell = (ctx: CellCtx<DenseRow>): Renderable => {
  const points = seriesOf(ctx.data.at, 31, BARS)
  const chart = svg("svg", { viewBox: `0 0 ${BARS * 2} 20`, class: "dz-bars", preserveAspectRatio: "none" })
  for (const [index, value] of points.entries()) {
    const height = Math.max(1, value * 19)
    chart.append(
      svg("rect", {
        x: index * 2,
        y: (20 - height).toFixed(2),
        width: 1.4,
        height: height.toFixed(2),
        class: value > 0.75 ? "dz-bar dz-bar-hot" : value > 0.4 ? "dz-bar dz-bar-warm" : "dz-bar",
      }),
    )
  }
  return chart
}

const STATES = ["queued", "running", "retried", "settled", "archived", "dropped"] as const

/** Six rows of dot plus label plus count, which is the shape a status column takes in practice. */
const statusCell = (ctx: CellCtx<DenseRow>): Renderable => {
  const host = h("div", "dz-status")
  for (const [index, name] of STATES.entries()) {
    const value = hash(ctx.data.at, 40 + index)
    const line = h("div", "dz-status-line")
    line.append(
      h("span", "dz-dot", ""),
      h("span", "dz-status-name", name),
      h("span", "dz-status-count", String(Math.round(value * 400))),
    )
    line.setAttribute("data-level", value > 0.7 ? "hot" : value > 0.35 ? "warm" : "cool")
    host.append(line)
  }
  return host
}

/** A track, a fill, four ticks, and the number, so the meter is readable without the tooltip. */
const progressCell = (ctx: CellCtx<DenseRow>): Renderable => {
  const share = ctx.data.health
  const host = h("div", "dz-meter")
  const track = h("div", "dz-meter-track")
  const fill = h("div", "dz-meter-fill")
  fill.style.setProperty("inline-size", `${(share * 100).toFixed(1)}%`)
  track.append(fill)
  for (let at = 1; at < 5; at++) {
    const tick = h("span", "dz-meter-tick")
    tick.style.setProperty("inset-inline-start", `${at * 20}%`)
    track.append(tick)
  }
  host.append(track, h("span", "dz-meter-value", `${(share * 100).toFixed(0)}%`))
  return host
}

/** A table inside a cell: a header row and four body rows of three cells each. */
const linesCell = (ctx: CellCtx<DenseRow>): Renderable => {
  const table = h("table", "dz-mini")
  const head = h("tr", "dz-mini-head")
  head.append(h("th", "dz-mini-th", "step"), h("th", "dz-mini-th", "ms"), h("th", "dz-mini-th", "n"))
  table.append(head)
  for (let at = 0; at < STEPS; at++) {
    const line = h("tr", "dz-mini-row")
    line.append(
      h("td", "dz-mini-td", pick(WORDS, ctx.data.at + at, 51)),
      h("td", "dz-mini-td dz-mini-num", String(Math.round(hash(ctx.data.at, 52 + at) * 900))),
      h("td", "dz-mini-td dz-mini-num", String(Math.round(hash(ctx.data.at, 62 + at) * 60))),
    )
    table.append(line)
  }
  return table
}

const TAGS = ["p0", "flaky", "owned", "slo", "paged", "muted", "beta", "canary"] as const

const tagsCell = (ctx: CellCtx<DenseRow>): Renderable => {
  const host = h("div", "dz-tags")
  for (const [index, tag] of TAGS.entries()) {
    if (hash(ctx.data.at, 70 + index) < 0.25) continue
    host.append(chip("dz-tag", tag))
  }
  return host
}

const RING = 2 * Math.PI * 12

/** A donut, which is the one mark here that needs a computed dash array rather than a width. */
const ringCell = (ctx: CellCtx<DenseRow>): Renderable => {
  const share = hash(ctx.data.at, 80)
  const chart = svg("svg", { viewBox: "0 0 32 32", class: "dz-ring" })
  chart.append(
    svg("circle", { cx: 16, cy: 16, r: 12, class: "dz-ring-track" }),
    svg("circle", {
      cx: 16,
      cy: 16,
      r: 12,
      class: "dz-ring-fill",
      "stroke-dasharray": `${(share * RING).toFixed(2)} ${RING.toFixed(2)}`,
      transform: "rotate(-90 16 16)",
    }),
    svg("text", { x: 16, y: 19, class: "dz-ring-text" }),
  )
  const label = chart.lastElementChild
  if (label !== null) label.textContent = String(Math.round(share * 99))
  return chart
}

const deltaCell = (ctx: CellCtx<DenseRow>): Renderable => {
  const points = seriesOf(ctx.data.at, 91, 12)
  const host = h("div", "dz-delta")
  for (const [index, value] of points.entries()) {
    const step = h("span", "dz-delta-step")
    step.style.setProperty("--dz-h", `${(value * 100).toFixed(0)}%`)
    step.setAttribute("data-up", String(value > (points[index - 1] ?? 0.5)))
    host.append(step)
  }
  return host
}

// --- The schema -------------------------------------------------------------

export const COLUMNS: readonly ColumnDef<DenseRow>[] = [
  checkboxColumn<DenseRow>(),
  dragColumn<DenseRow>(),
  rowNumberColumn<DenseRow>(),
  { id: "name", header: "Service", width: 300, movable: true, resizable: true, sortable: true, cell: whoCell },
  { id: "trend", header: "Trend", width: 180, movable: true, resizable: true, sortable: false, cell: trendCell },
  { id: "load", header: "Load", width: 170, movable: true, resizable: true, sortable: false, cell: loadCell },
  { id: "status", header: "Queues", width: 190, movable: true, resizable: true, sortable: false, cell: statusCell },
  { id: "health", header: "Health", width: 160, movable: true, resizable: true, sortable: true, cell: progressCell },
  { id: "lines", header: "Last steps", width: 210, movable: true, resizable: true, sortable: false, cell: linesCell },
  { id: "delta", header: "Delta", width: 140, movable: true, resizable: true, sortable: false, cell: deltaCell },
  { id: "tags", header: "Tags", width: 160, movable: true, resizable: true, sortable: false, cell: tagsCell },
  { id: "region", header: "Ring", width: 90, movable: true, resizable: true, sortable: false, cell: ringCell },
]

// --- The route --------------------------------------------------------------

export const denseDemo: DemoRoute = {
  slug: "dense",
  title: "Expensive rows",
  blurb:
    "20,000 rows of nine slot columns: two SVG charts, a donut, a five-line status stack, a " +
    "progress meter, a four-row nested table, and an avatar with two badges and a truncated note.",
  stressing:
    "Windowing when the cost is per row entering rather than per row held. Every row that crosses " +
    "the window edge builds a few hundred elements and the row leaving tears the same number down.",
  features: [
    "view.virtualize.row",
    "view.scroll",
    "view.slots",
    "view.density",
    "row.sort",
    "row.select",
    "row.order",
    "row.height",
    "col.order",
    "col.resize",
    "col.size",
  ],
  defects: [
    "Slots.row and Slots.dragPreview are declared in src/0_types.ts and never read by src/10_render.ts, so a route this heavy can replace every cell and neither the row box nor the drag mark around them.",
    "A deferred drag measures its landing box with getBoundingClientRect once per frame the preview is live, which is one forced layout per pointermove on top of whatever the rendered rows already cost.",
  ],
  mount: (hosts) => mountInView(hosts.stage, () => mount(hosts)),
}

function mount(hosts: DemoHosts): DemoHandle {
  const subs = new Subscription()
  const box = stageBox(hosts, "stage-box")

  const seed = box.getBoundingClientRect()
  const viewport = Signal<Viewport>({
    top: 0,
    left: 0,
    width: Math.round(seed.width),
    height: Math.round(seed.height),
  })

  // Every row the same height, written as a per-row extent so the sizer measures the run this route
  // actually draws rather than the density default three charts do not fit in.
  const heights: Readonly<Record<RowId, number>> = Object.fromEntries(
    ROWS.map((it) => [it.id, ROW_PX] as const),
  )

  const dense: Grid<DenseRow> = grid<DenseRow>({
    id: "dense",
    rows: ROWS,
    columns: COLUMNS,
    rowId: (it) => it.id,
    state: Signal<Partial<GridState>>({
      virtualize: { vertical: true, horizontal: false },
      rowHeight: heights,
      density: "comfortable",
    }),
    viewport,
    overscan: 2,
    // Every cell here is a chart or a stack, and `interactive` keeps a click inside one of them
    // from reaching this, so the row body is the only door. @feature row.select
    epics: [...defaultEpics<DenseRow>(), selectRowsOnCellClick<DenseRow>()],
  })

  const handle = render(dense, box)
  const scroll = box.querySelector(".sg-scroll")

  const scrollTo = (top: number): void => {
    if (scroll instanceof HTMLElement) scroll.scrollTop = top
  }

  // --- readouts -------------------------------------------------------------

  const num = (value: number): string => value.toLocaleString("en-US")

  const renderedRows = (): number => box.getElementsByClassName("sg-row").length
  const nodes = (): number => box.getElementsByTagName("*").length
  const svgNodes = (): number => box.getElementsByTagName("svg").length

  const painted$ = afterPaint(dense.view.plan.$)

  const perRow = (): string => {
    const drawn = renderedRows()
    return drawn === 0 ? "n/a" : num(Math.round(nodes() / drawn))
  }

  const modelGroup = group("Model", [
    readbackField("rows", Signal<string>(() => num(ROW_COUNT))),
    readbackField("slot columns", Signal<string>(() => num(COLUMNS.filter((it) => it.cell !== undefined).length))),
    readbackField("row height", Signal<string>(() => `${num(ROW_PX)} px`)),
    readbackField("samples per sparkline", Signal<string>(() => num(SERIES))),
    readbackField("bars per load chart", Signal<string>(() => num(BARS))),
  ])

  const costGroup: Bound = group("Cost", [
    readbackField("rendered rows", paintedText(painted$, () => num(renderedRows()))),
    readbackField("DOM nodes", paintedText(painted$, () => num(nodes()))),
    readbackField("nodes per rendered row", paintedText(painted$, perRow)),
    readbackField("svg elements", paintedText(painted$, () => num(svgNodes()))),
  ])

  const windowGroup: Bound = group("Window", [
    checkField("virtualize down the page", dense.state.virtualize.vertical),
    segmentField(
      "density",
      [
        { value: "compact", label: "Compact" },
        { value: "standard", label: "Standard" },
        { value: "comfortable", label: "Comfortable" },
      ],
      dense.state.density,
    ),
    readbackField("plan span", Signal<string>(() => {
      const span = dense.view.plan.$().span
      return `[${num(span.start)}, ${num(span.end)})`
    })),
    readbackField("scroller height", Signal<string>(() => `${num(Math.round(dense.view.plan.$().centerTotal))} px`)),
    readbackField("density floor", Signal<string>(() => `${num(ROW_HEIGHT[dense.state.density.$()])} px`)),
    actions([
      { label: "top", run: () => scrollTo(0) },
      { label: "row 10,000", run: () => scrollTo(10_000 * ROW_PX) },
      { label: "last row", run: () => scrollTo(ROW_COUNT * ROW_PX) },
    ]),
  ])

  const gestureGroup: Bound = group("Deferred gestures", [
    readbackField("drag mode", Signal<string>(() => "preview, the grid() default")),
    readbackField("live preview", Signal<string>(() => {
      const held = dense.state.drag.$()
      if (held === null) return "nothing held"
      return held.kind === "colSize"
        ? `${held.col} to ${Math.round(held.width)} px`
        : held.kind === "colMove"
          ? `${held.col} lands ${held.side} of ${held.over}`
          : `${held.row} lands ${held.side} of ${held.over}`
    })),
    readbackField("selected rows", Signal<string>(() =>
      num(Object.values(dense.state.rowSelection.$()).filter(Boolean).length),
    )),
  ])

  hosts.panel.append(
    aboutPanel(denseDemo),
    modelGroup.el,
    costGroup.el,
    windowGroup.el,
    gestureGroup.el,
  )

  const panelReadout = readout(dense, box)
  hosts.readout.append(panelReadout.el)

  const panel$ = merge(modelGroup.bind$, costGroup.bind$, windowGroup.bind$, gestureGroup.bind$)
  subs.add(runWhenInView(panel$))

  window.__demo = {
    rowCount: renderedRows,
    nodeCount: nodes,
    nodesPerRow: () => {
      const drawn = renderedRows()
      return drawn === 0 ? 0 : Math.round(nodes() / drawn)
    },
    scrollTo,
  }

  return {
    grid: dense,
    stop: () => {
      subs.unsubscribe()
      panelReadout.stop()
      handle.stop()
      dense.close()
      box.remove()
    },
  }
}
