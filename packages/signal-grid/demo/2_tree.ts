// Route 2. Tree flattening and virtualization together: 636 directories over five levels holding
// 50,000 leaves, with the DOM row count printed against the flat length on every frame.
import { Signal } from "@hafley66/signals"
import { map, merge, share, Subscription, tap } from "rxjs"
import { mountInView, runWhenInView } from "@hafley66/docs-kit"
import { createMeasureStore, defaultEpics, expandOnCellDoubleClick, grid, render, ROW_HEIGHT, selectRowsOnCellClick, type CellCtx, type ColumnDef, type GridState, type MeasureStore, type Renderable, type RowId, type Viewport } from "../src/index.js"
import {
  actions,
  afterPaint,
  checkField,
  group,
  h,
  paintedText,
  readbackField,
  segmentField,
} from "./controls.js"
import { directoryIds, formatDate, formatSize, tree, type FsRow } from "./data.js"
import { readout } from "./readout.js"
import { aboutPanel, stageBox, type DemoHandle, type DemoHosts, type DemoRoute } from "./0_shell.js"

const ROOTS = tree()

/** Every directory open on first paint, so DOM rows against flat length is the whole 50,636. */
const ALL_OPEN: Readonly<Record<string, boolean>> = Object.fromEntries(
  directoryIds().map((it) => [it, true] as const),
)

/** The largest root, so a bar is a share of the whole volume rather than of its own siblings. */
const MAX_SIZE = ROOTS.reduce((carry, it) => (it.size > carry ? it.size : carry), 1)

const LOG_FLOOR = Math.log(64)
const LOG_CEILING = Math.log(MAX_SIZE)

/** Log scale, normalized between the smallest file and the largest volume, or every bar is full. */
const barFraction = (size: number): number => {
  const scaled = (Math.log(Math.max(64, size)) - LOG_FLOOR) / (LOG_CEILING - LOG_FLOOR)
  return Math.min(1, Math.max(0.015, scaled))
}

const sizeCell = (ctx: CellCtx<FsRow>): Renderable => {
  const value = typeof ctx.value === "number" ? ctx.value : 0
  const bar = h("span", "size-bar")
  bar.setAttribute("data-folder", String(ctx.node.hasChildren))
  bar.style.setProperty("--bar", `${(barFraction(value) * 100).toFixed(2)}%`)
  bar.title = formatSize(value)
  const fill = h("span", "size-fill")
  bar.append(fill)
  return bar
}

const nameCell = (ctx: CellCtx<FsRow>): Renderable => {
  const el = h("span", "cell-name")
  el.append(h("span", "cell-icon", ctx.node.hasChildren ? "■" : "▫"), String(ctx.value ?? ""))
  return el
}

const COLUMNS: readonly ColumnDef<FsRow>[] = [
  { id: "name", header: "Name", type: "string", flex: 2, minWidth: 280, resizable: true, cell: nameCell },
  { id: "size", header: "Size", type: "number", width: 180, resizable: true, cell: sizeCell },
  { id: "modified", header: "Modified", type: "date", width: 130, resizable: true, cell: (ctx) => formatDate(ctx.value) },
  { id: "kind", header: "Kind", type: "string", width: 120, resizable: true },
]

export const treeDemo: DemoRoute = {
  slug: "tree",
  title: "Filesystem tree",
  blurb:
    "Six volumes, 636 directories, 50,000 files, five levels deep, through `subRows`. Size draws as " +
    "a log-scaled bar so an aggregate reads at a glance instead of as a number.",
  stressing:
    "Tree flattening and row virtualization at the same time. The readout prints DOM rows against " +
    "flat length, so a flatten that forgets a collapsed subtree shows up as a row count in the tens " +
    "of thousands.",
  features: ["row.tree", "row.expand", "row.select", "row.sort", "row.height", "view.virtualize.row", "view.scroll", "view.density", "view.slots"],
  defects: [
    "Alt-click on an expander opens the whole branch through descendantsOf, which walks 50,000 keys on the root volumes and blocks the frame.",
    "MeasureStore is exported and wired here, but no stage of the kernel reads it: extents and approaching$ feed nothing.",
  ],
  mount: (hosts) => mountInView(hosts.stage, () => mount(hosts)),
}

function mount(hosts: DemoHosts): DemoHandle {
  const subs = new Subscription()
  const box = stageBox(hosts, "stage-box")

  const seedBox = box.getBoundingClientRect()
  const viewport = Signal<Viewport>({
    top: 0,
    left: 0,
    width: Math.round(seedBox.width),
    height: Math.round(seedBox.height),
  })

  const files = grid<FsRow>({
    id: "tree",
    rows: ROOTS,
    columns: COLUMNS,
    rowId: (it) => it.id,
    subRows: (it) => it.children,
    state: Signal<Partial<GridState>>({
      virtualize: { vertical: true, horizontal: false },
      expanded: { ...ALL_OPEN },
      sort: [{ field: "size", sort: "desc" }],
    }),
    viewport,
    overscan: 8,
    // The chevron is 12px wide and the row is the whole width, so the row body gets both gestures:
    // one click picks the node, two toggles it. @feature row.expand @feature row.select
    epics: [...defaultEpics<FsRow>(), selectRowsOnCellClick<FsRow>(), expandOnCellDoubleClick<FsRow>()],
  })

  const handle = render(files, box)
  const scroll = box.querySelector(".sg-scroll")

  box.addEventListener("keydown", (event) => {
    if (event.key.startsWith("Arrow") || event.key === " ") event.preventDefault()
  })

  // --- expansion ------------------------------------------------------------

  const openMap = (keys: readonly string[]): Record<RowId, boolean> => {
    const out: Record<RowId, boolean> = {}
    for (const key of keys) out[key] = true
    return out
  }

  const expandAll = (): void => {
    files.state.expanded.$(openMap(directoryIds()))
  }

  const collapseAll = (): void => {
    files.state.expanded.$({})
  }

  const expandToDepth = (levels: number): void => {
    const axis = files.view.sorted.$()
    const out: Record<RowId, boolean> = {}
    const walk = (keys: readonly string[], depth: number): void => {
      if (depth >= levels) return
      for (const key of keys) {
        const kids = axis.children.get(key)
        if (kids === undefined || kids.length === 0) continue
        out[key] = true
        walk(kids, depth + 1)
      }
    }
    walk(axis.roots, 0)
    files.state.expanded.$(out)
  }

  const openCount = (): number => {
    const open = files.state.expanded.$()
    let on = 0
    for (const key of Object.keys(open)) if (open[key] === true) on++
    return on
  }

  // --- measurement ----------------------------------------------------------

  const store: MeasureStore = createMeasureStore({
    initial: ROW_HEIGHT[files.state.density.$()],
    direction: "vertical",
    onChange: () => {},
    root: scroll instanceof HTMLElement ? scroll : null,
    bufferPx: 240,
  })
  // Cold: the batch size is counted only while the readback that prints it is bound.
  const approaching = Signal<number>(store.approaching$.pipe(map((it) => it.length)), 0)
  subs.add(() => store.close())

  const observed = new Map<string, () => void>()
  const observeRendered = (): void => {
    const seen = new Set<string>()
    for (const el of Array.from(box.getElementsByClassName("sg-row"))) {
      if (!(el instanceof HTMLElement)) continue
      const key = el.getAttribute("data-row-id")
      if (key === null) continue
      seen.add(key)
      if (observed.has(key)) continue
      observed.set(key, store.observe(key, el))
    }
    for (const [key, release] of observed) {
      if (seen.has(key)) continue
      release()
      observed.delete(key)
    }
  }

  // --- panel ----------------------------------------------------------------

  const domRows = (): number => box.getElementsByClassName("sg-row").length

  const painted$ = afterPaint(files.view.plan.$)
  // The observation runs upstream of the numbers that report it, so a frame never prints a count
  // taken before the rows it describes were observed.
  const measured$ = painted$.pipe(tap(observeRendered), share())

  const rowGroup = group("Tree", [
    actions([
      { label: "expand all", title: "636 directories", run: expandAll },
      { label: "collapse all", run: collapseAll },
      { label: "depth 1", run: () => expandToDepth(1) },
      { label: "depth 2", run: () => expandToDepth(2) },
      { label: "depth 3", run: () => expandToDepth(3) },
    ]),
    readbackField("open directories", Signal<string>(() => openCount().toLocaleString("en-US"))),
    readbackField("flat length", Signal<string>(() => files.view.flat.$().length.toLocaleString("en-US"))),
    readbackField("rows in the document", paintedText(painted$, () => domRows().toLocaleString("en-US"))),
    readbackField(
      "DOM rows / flat length",
      paintedText(painted$, () => {
        const flat = files.view.flat.$().length
        const shown = domRows()
        const percent = flat === 0 ? 0 : (shown / flat) * 100
        return `${shown} / ${flat.toLocaleString("en-US")} (${percent.toFixed(3)}%)`
      }),
    ),
    readbackField(
      "deepest rendered depth",
      paintedText(painted$, () => {
        let deepest = 0
        for (const el of Array.from(box.getElementsByClassName("sg-row"))) {
          if (!(el instanceof HTMLElement)) continue
          const depth = Number(el.style.getPropertyValue("--sg-depth"))
          if (Number.isFinite(depth) && depth > deepest) deepest = depth
        }
        return String(deepest)
      }),
    ),
  ])

  const measureGroup = group("MeasureStore (read only)", [
    readbackField("observed rows", paintedText(measured$, () => String(observed.size))),
    readbackField("measured extents", paintedText(measured$, () => String(store.extents.size))),
    readbackField("rolling estimate", paintedText(measured$, () => `${store.estimate().toFixed(1)} px`)),
    readbackField("last approaching$ batch", Signal<string>(() => String(approaching.$()))),
  ])

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
    readbackField(
      "sort model",
      Signal<string>(() => {
        const model = files.state.sort.$()
        return model.length === 0 ? "none" : model.map((it) => `${it.field} ${it.sort}`).join(", ")
      }),
    ),
    actions([
      { label: "sort by size desc", run: () => files.state.sort.$([{ field: "size", sort: "desc" }]) },
      { label: "sort by name asc", run: () => files.state.sort.$([{ field: "name", sort: "asc" }]) },
      { label: "clear sort", run: () => files.state.sort.$([]) },
    ]),
  ])

  hosts.panel.append(aboutPanel(treeDemo), rowGroup.el, measureGroup.el, viewGroup.el)

  const panelReadout = readout(files, box)
  hosts.readout.append(panelReadout.el)

  const panel$ = merge(rowGroup.bind$, measureGroup.bind$, viewGroup.bind$)
  subs.add(runWhenInView(panel$))

  return {
    grid: files,
    stop: () => {
      subs.unsubscribe()
      for (const release of observed.values()) release()
      observed.clear()
      panelReadout.stop()
      handle.stop()
      files.close()
      box.remove()
    },
  }
}
