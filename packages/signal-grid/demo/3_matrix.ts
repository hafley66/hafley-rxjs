// Route 3. `orientation: "columns"`: the column axis stands on the y dimension and the rows run
// across. The same state drives both seatings, and a 2 by 3 span becomes 3 by 2 in the transpose.
import { Signal } from "@hafley66/signals"
import { Subscription } from "rxjs"
import {
  cellParts,
  grid,
  render,
  transpose,
  type CellId,
  type ColumnDef,
  type GridState,
  type Orientation,
  type Viewport,
} from "../src/index.js"
import { actions, checkField, group, h, readbackField, segmentField, type Option } from "./controls.js"
import { readout } from "./readout.js"
import { aboutPanel, stageBox, type DemoHandle, type DemoHosts, type DemoRoute } from "./0_shell.js"

interface Metric {
  readonly id: string
  readonly region: string
  readonly q1: number
  readonly q2: number
  readonly q3: number
  readonly q4: number
  readonly total: number
  readonly note: string
}

const REGIONS = ["north", "south", "east", "west", "alpine", "coastal", "delta", "plateau"] as const

const ROWS: readonly Metric[] = REGIONS.map((region, index) => {
  const base = 120 + index * 37
  const quarters = [base, base + 18, base + 41, base + 9]
  const total = quarters.reduce((carry, it) => carry + it, 0)
  return {
    id: region,
    region,
    q1: quarters[0] ?? 0,
    q2: quarters[1] ?? 0,
    q3: quarters[2] ?? 0,
    q4: quarters[3] ?? 0,
    total,
    note: index % 2 === 0 ? "on plan" : "under review",
  }
})

/** The one spanning cell: q1 of the second entry reaches two entries down and three across. */
const SPAN_AT_INDEX = 1
const SPAN_ROWS = 2
const SPAN_COLS = 3

const COLUMNS: readonly ColumnDef<Metric>[] = [
  { id: "region", header: "Region", width: 120, resizable: true },
  {
    id: "q1",
    header: "Q1",
    type: "number",
    width: 90,
    resizable: true,
    span: (_row, index) => (index === SPAN_AT_INDEX ? { rows: SPAN_ROWS, cols: SPAN_COLS } : undefined),
  },
  { id: "q2", header: "Q2", type: "number", width: 90, resizable: true },
  { id: "q3", header: "Q3", type: "number", width: 90, resizable: true },
  { id: "q4", header: "Q4", type: "number", width: 90, resizable: true },
  { id: "total", header: "Total", type: "number", width: 100, resizable: true },
  { id: "note", header: "Note", width: 150, resizable: true },
]



/** `cellId` joins with NUL, which no panel can print. Both halves come back readable. */
const printCell = (id: CellId): string => {
  const parts = cellParts(id)
  return `${parts[0]} × ${parts[1]}`
}

export const matrixDemo: DemoRoute = {
  slug: "matrix",
  title: "Matrix",
  blurb:
    "Eight regions by seven columns, with a toggle that moves the column axis onto the vertical " +
    "seat live. The span relation is printed on both sides of the toggle.",
  stressing:
    "The transpose. One state, two seatings, and the library's own acceptance test made visible: a " +
    "2 by 3 span has to come back as 3 by 2 with both halves of its address swapped.",
  features: ["view.list", "cell.span", "col.pin", "col.resize", "row.pin", "row.sort", "view.slots", "view.theme"],
  defects: [
    "Under orientation columns every cell renders empty: 10_render.ts looks the vertical key up in the row value map, and a vertical key is a column id.",
    "Under the transpose nothing renders the vertical entry's own label, so a matrix has no row headings. This demo relabels them.",
    "Header cells under the transpose print raw row ids until relabelRowHeaders runs, because the header label falls back to the key when no ColumnDef carries it.",
  ],
  mount,
}

function mount(hosts: DemoHosts): DemoHandle {
  const subs = new Subscription()
  const box = stageBox(hosts, "stage-box stage-matrix")

  const seedBox = box.getBoundingClientRect()
  const viewport = Signal<Viewport>({
    top: 0,
    left: 0,
    width: Math.round(seedBox.width),
    height: Math.round(seedBox.height),
  })

  const metrics = grid<Metric>({
    id: "matrix",
    rows: ROWS,
    columns: COLUMNS,
    rowId: (it) => it.id,
    state: Signal<Partial<GridState>>({
      virtualize: false,
      orientation: "rows",
      rowHeight: { north: 130, south: 130, east: 130, west: 130, alpine: 130, coastal: 130, delta: 130, plateau: 130 },
    }),
    viewport,
  })

  const handle = render(metrics, box)

  // The renderer honours the transpose now, so the cells paint themselves. What it cannot do is
  // label the horizontal band: under `"columns"` that band holds rows, a row carries no header
  // string, and the renderer skips `slots.header` there rather than handing it a row id.
  const relabelRowHeaders = (): void => {
    if (metrics.state.orientation.$() !== "columns") return
    const byRow = metrics.view.detailed.$().by
    for (const headEl of Array.from(box.getElementsByClassName("sg-head-cell"))) {
      if (!(headEl instanceof HTMLElement)) continue
      const rowId = headEl.getAttribute("data-col-id")
      if (rowId === null) continue
      headEl.textContent = byRow.get(rowId)?.region ?? rowId
    }
  }

  // --- readouts -------------------------------------------------------------

  const fingerprint = (): string =>
    JSON.stringify({
      sort: metrics.state.sort.$(),
      group: metrics.state.group.$(),
      colPinning: metrics.state.colPinning.$(),
      rowPinning: metrics.state.rowPinning.$(),
      colWidth: metrics.state.colWidth.$(),
      density: metrics.state.density.$(),
      virtualize: metrics.state.virtualize.$(),
    })

  const seedFingerprint = fingerprint()

  const describeSpans = (): string => {
    const relation = metrics.view.spans.$()
    if (relation.size === 0) return "none"
    return [...relation.entries()]
      .map(([anchor, extent]) => `${printCell(anchor)} = ${extent.vertical}v × ${extent.horizontal}h`)
      .join(", ")
  }

  const describeCovered = (): string => {
    const covered = metrics.view.covered.$()
    if (covered.size === 0) return "none"
    return `${covered.size}: ${[...covered].map(printCell).join(", ")}`
  }

  // Workaround for defect 6. `view.vertical` does not notify when `orientation` moves, so `plan`
  // and `cols` keep the previous seating until a key they do track changes and back.
  const settleTranspose = (): void => {
    requestAnimationFrame(() => {
      metrics.view.vertical.$()
      metrics.view.horizontal.$()
      const density = metrics.state.density.$()
      const list = metrics.state.listView.$()
      metrics.state.density.$(density === "compact" ? "standard" : "compact")
      metrics.state.listView.$(!list)
      requestAnimationFrame(() => {
        metrics.state.density.$(density)
        metrics.state.listView.$(list)
        refresh()
      })
    })
  }

  const setOrientation = (next: Orientation): void => {
    metrics.state.orientation.$(next)
    settleTranspose()
  }

  const ORIENTATIONS: readonly Option<Orientation>[] = [
    { value: "rows", label: "rows down" },
    { value: "columns", label: "columns down" },
  ]

  const axisGroup = group("Seating", [
    segmentField<Orientation>("orientation", ORIENTATIONS, () => metrics.state.orientation.$(), setOrientation),
    actions([
      { label: "transpose", run: () => setOrientation(transpose(metrics.state.orientation.$())) },
      { label: "transpose twice", run: () => setOrientation(transpose(transpose(metrics.state.orientation.$()))) },
    ]),
    readbackField("vertical entries", () => {
      const nodes = metrics.view.vertical.$().nodes
      return `${nodes.length}: ${nodes.map((it) => it.key).slice(0, 4).join(", ")}…`
    }),
    readbackField("horizontal entries", () => {
      const nodes = metrics.view.horizontal.$().nodes
      return `${nodes.length}: ${nodes.map((it) => it.key).slice(0, 4).join(", ")}…`
    }),
    readbackField("plan.center", () => metrics.view.plan.$().center.slice(0, 4).join(", ")),
    readbackField("state unchanged by the toggle", () =>
      fingerprint() === seedFingerprint ? "yes, byte for byte" : "no, a control moved it",
    ),
  ])

  const spanGroup = group("Spanning", [
    readbackField("declared on q1", () => `rows ${SPAN_ROWS}, cols ${SPAN_COLS} at index ${SPAN_AT_INDEX}`),
    readbackField("view.spans", describeSpans),
    readbackField("view.covered", describeCovered),
    readbackField("acceptance", () => {
      const relation = metrics.view.spans.$()
      const first = [...relation.values()][0]
      if (first === undefined) return "no span"
      const wanted =
        metrics.state.orientation.$() === "rows"
          ? { vertical: SPAN_ROWS, horizontal: SPAN_COLS }
          : { vertical: SPAN_COLS, horizontal: SPAN_ROWS }
      const ok = first.vertical === wanted.vertical && first.horizontal === wanted.horizontal
      return ok ? `${wanted.vertical} × ${wanted.horizontal}, as declared` : "mismatch"
    }),
  ])

  const viewGroup = group("View", [
    checkField("list view (the degenerate transpose)", () => metrics.state.listView.$(), (next) =>
      metrics.state.listView.$(next),
    ),
    readbackField("horizontal run after collapse", () => String(metrics.view.cols.$().length)),
    actions([
      { label: "pin q1 start", run: () => metrics.state.colPinning.$({ ...metrics.state.colPinning.$(), q1: "start" }) },
      { label: "pin north start", run: () => metrics.state.rowPinning.$({ ...metrics.state.rowPinning.$(), north: "start" }) },
      { label: "unpin everything", run: () => { metrics.state.colPinning.$({}); metrics.state.rowPinning.$({}) } },
    ]),
  ])

  hosts.panel.append(aboutPanel(matrixDemo), axisGroup.el, spanGroup.el, viewGroup.el)

  const panelReadout = readout(metrics, box)
  hosts.readout.append(panelReadout.el)

  let queued = false
  const refresh = (): void => {
    if (queued) return
    queued = true
    requestAnimationFrame(() => {
      queued = false
      relabelRowHeaders()
      axisGroup.refresh()
      spanGroup.refresh()
      viewGroup.refresh()
    })
  }

  subs.add(metrics.state.$.subscribe(refresh))
  subs.add(metrics.view.plan.$.subscribe(refresh))
  refresh()

  return {
    grid: metrics,
    stop: () => {
      subs.unsubscribe()
      panelReadout.stop()
      handle.stop()
      metrics.close()
      box.remove()
    },
  }
}
