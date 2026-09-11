// Route 5. A million rows and 240 columns with both seats of the window switched on, which is the
// shape a spreadsheet demo puts on the table and the one this kernel has never been asked for.
import { Signal } from "@hafley66/signals"
import { Subscription } from "rxjs"
import {
  grid,
  mountInView,
  render,
  ROW_HEIGHT,
  runWhenInView,
  type ColumnDef,
  type Grid,
  type GridState,
  type RowId,
  type Viewport,
} from "../src/index.js"
import { actions, checkField, group, readbackField, type Bound } from "./controls.js"
import { readout } from "./readout.js"
import { aboutPanel, stageBox, type DemoHandle, type DemoHosts, type DemoRoute } from "./0_shell.js"

// --- The relation, held as arithmetic ---------------------------------------

export const ROW_COUNT = 1_000_000
export const COL_COUNT = 240

const COL_WIDTH = 96
/** Compact, because 1,000,000 rows at the standard 36 px asks for a 36,000,000 px scroller and the
 * engine stops at 33,554,432. The readout prints both numbers rather than asserting the headroom. */
const DENSITY: GridState["density"] = "compact"
const SCROLL_CEILING = 33_554_432

/** A row holds its index and nothing else. Every cell is a function of that index and the column's,
 * so 240,000,000 values exist without one of them being stored. */
export interface SheetRow {
  readonly id: RowId
  readonly at: number
}

const INDEX_KEY = /^\d+$/

/** Index-derived rows behind a proxy over an empty array: `Array.isArray` still answers true and
 * `map` still walks it, and no array of a million objects is ever held. */
export const ROWS: readonly SheetRow[] = new Proxy([] as SheetRow[], {
  get: (target, key) => {
    if (key === "length") return ROW_COUNT
    if (typeof key === "string" && INDEX_KEY.test(key)) {
      const at = Number(key)
      return at < ROW_COUNT ? { id: `r${at}`, at } : undefined
    }
    return Reflect.get(target, key) as unknown
  },
  has: (target, key) =>
    typeof key === "string" && INDEX_KEY.test(key)
      ? Number(key) < ROW_COUNT
      : Reflect.has(target, key),
})

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

/** A, B, ... Z, AA, AB, the header a spreadsheet puts over its columns. */
const columnName = (index: number): string => {
  const high = Math.floor(index / ALPHABET.length)
  const low = index % ALPHABET.length
  return high === 0 ? ALPHABET[low] ?? "" : `${ALPHABET[high - 1] ?? ""}${ALPHABET[low] ?? ""}`
}

export const COLUMNS: readonly ColumnDef<SheetRow>[] = Array.from(
  { length: COL_COUNT },
  (_value, index) => ({
    id: `c${String(index).padStart(3, "0")}`,
    header: columnName(index),
    type: "number" as const,
    width: COL_WIDTH,
    value: (row: SheetRow): number => (row.at * 31 + index * 7) % 100_000,
  }),
)

/** The same probe `scripts/stats.mjs` runs, taken at both counts with rows pre-allocated so the two
 * are comparable: `node --expose-gc`, one grid built, `heapUsed` differenced across a forced gc. */
const RETAINED_PER_ROW = { at100k: 126.5, atMillion: 114.7 } as const

// --- The route ---------------------------------------------------------------

export const sheetDemo: DemoRoute = {
  slug: "sheet",
  title: "Million-row sheet",
  blurb:
    "1,000,000 rows and 240 columns, both seats of the window on, rows minted from their index " +
    "rather than stored, and the panel reporting the rendered cell count against the model's.",
  stressing:
    "The claim that one windowing serves both runs, at the size where a grid that only windows " +
    "rows still puts 240 cells in the document per row and drops frames sideways.",
  features: [
    "view.virtualize.row",
    "view.virtualize.col",
    "view.scroll",
    "col.size",
    "col.type",
    "cell.focus",
  ],
  defects: [
    "A 1,000,000 row scroller at the standard density asks for 36,000,000 px and the engine caps near 33,554,432, so this route pins itself to compact.",
    "state.density is not offered here for the same reason: switching to comfortable would put the last rows out of reach of the scrollbar.",
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

  const sheet: Grid<SheetRow> = grid<SheetRow>({
    id: "sheet",
    rows: ROWS,
    columns: COLUMNS,
    rowId: (it) => it.id,
    state: Signal<Partial<GridState>>({
      virtualize: { vertical: true, horizontal: true },
      density: DENSITY,
    }),
    viewport,
    overscan: 4,
  })

  const handle = render(sheet, box)
  const scroll = box.querySelector(".sg-scroll")

  const scrollTo = (top: number, left: number): void => {
    if (!(scroll instanceof HTMLElement)) return
    scroll.scrollTop = top
    scroll.scrollLeft = left
  }

  // --- readouts -------------------------------------------------------------

  const num = (value: number): string => value.toLocaleString("en-US")

  const renderedRows = (): number => sheet.view.plan.$().center.length
  const renderedCols = (): number => sheet.view.colPlan.$().center.length
  const renderedCells = (): number => box.getElementsByClassName("sg-cell").length

  const modelCells = ROW_COUNT * COL_COUNT

  let frames = 0
  let framesSince = performance.now()
  let framesPerSecond = 0
  let ticking = 0

  const tick = (): void => {
    frames++
    const now = performance.now()
    if (now - framesSince >= 500) {
      framesPerSecond = Math.round((frames * 1000) / (now - framesSince))
      frames = 0
      framesSince = now
      scrollGroup.refresh()
      windowGroup.refresh()
    }
    ticking = requestAnimationFrame(tick)
  }

  // --- panel ----------------------------------------------------------------

  const modelGroup = group("Model", [
    readbackField("rows", () => num(ROW_COUNT)),
    readbackField("columns", () => num(COL_COUNT)),
    readbackField("cells", () => num(modelCells)),
    readbackField("rows are", () => "minted from the index, never stored"),
    readbackField("flat length", () => num(sheet.view.flat.$().length)),
  ])

  const windowGroup: Bound = group("Window", [
    checkField(
      "virtualize down the page",
      () => sheet.state.virtualize.vertical.$(),
      (next) => sheet.state.virtualize.vertical.$(next),
    ),
    checkField(
      "virtualize across the page",
      () => sheet.state.virtualize.horizontal.$(),
      (next) => sheet.state.virtualize.horizontal.$(next),
    ),
    readbackField("rendered rows", () => num(renderedRows())),
    readbackField("rendered columns", () => num(renderedCols())),
    readbackField("rendered cells", () => num(renderedCells())),
    readbackField("model cells per rendered cell", () => {
      const drawn = renderedCells()
      return drawn === 0 ? "n/a" : `${num(Math.round(modelCells / drawn))} to 1`
    }),
  ])

  const scrollGroup: Bound = group("Scroll", [
    readbackField("frames per second", () => (framesPerSecond === 0 ? "sampling" : num(framesPerSecond))),
    readbackField("scroller height", () => {
      const total = Math.round(sheet.view.plan.$().centerTotal)
      return `${num(total)} px of ${num(SCROLL_CEILING)}`
    }),
    readbackField("row height", () => `${num(ROW_HEIGHT[DENSITY])} px, density ${DENSITY}`),
    actions([
      { label: "top", run: () => scrollTo(0, 0) },
      { label: "row 500,000", run: () => scrollTo(500_000 * ROW_HEIGHT[DENSITY], 0) },
      { label: "last row", run: () => scrollTo(ROW_COUNT * ROW_HEIGHT[DENSITY], 0) },
      { label: "last column", run: () => scrollTo(0, COL_COUNT * COL_WIDTH) },
      { label: "far corner", run: () => scrollTo(ROW_COUNT * ROW_HEIGHT[DENSITY], COL_COUNT * COL_WIDTH) },
    ]),
  ])

  const costGroup = group("Cost", [
    readbackField("retained per row at 100k", () => `${RETAINED_PER_ROW.at100k} B`),
    readbackField("retained per row at 1M", () => `${RETAINED_PER_ROW.atMillion} B`),
    readbackField("measured by", () => "scripts/stats.mjs, same probe at both counts"),
  ])

  hosts.panel.append(aboutPanel(sheetDemo), modelGroup.el, windowGroup.el, scrollGroup.el, costGroup.el)

  const panelReadout = readout(sheet, box)
  hosts.readout.append(panelReadout.el)

  function refresh(): void {
    modelGroup.refresh()
    windowGroup.refresh()
    scrollGroup.refresh()
    costGroup.refresh()
  }

  subs.add(runWhenInView(sheet.state.$, () => refresh()))
  subs.add(runWhenInView(sheet.view.plan.$, () => windowGroup.refresh()))
  subs.add(runWhenInView(sheet.view.colPlan.$, () => windowGroup.refresh()))
  refresh()
  ticking = requestAnimationFrame(tick)

  window.__demo = {
    rowCount: () => box.getElementsByClassName("sg-row").length,
    cellCount: renderedCells,
    scrollTo,
    modelRows: () => sheet.view.flat.$().length,
  }

  return {
    grid: sheet,
    stop: () => {
      cancelAnimationFrame(ticking)
      subs.unsubscribe()
      panelReadout.stop()
      handle.stop()
      sheet.close()
      box.remove()
    },
  }
}
