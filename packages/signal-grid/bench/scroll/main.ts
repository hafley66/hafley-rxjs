// @comment-ok: the factor list this page exists to vary, and why each one is a factor, with no
// runtime home outside the matrix it feeds
//
// One page, every factor on the query string, so a run differs from its neighbour in exactly one
// place. `bench/scroll.mjs` walks the matrix and `bench/README.md` records what came back.
//
// | factor | levels | why it is a factor |
// | rows | any | the relation the window is cut from |
// | width, height | any | the viewport, which with the row height sets how many rows are held |
// | cell | plain, heavy | build cost per row: one text node against a chart, a meter and a stack |
// | extent | uniform, varied | whether the consumer declares a height per row |
// | overscan | any | rows held beyond the viewport on each side |
// | cv | 0, 1 | `content-visibility: auto` on the rendered rows |
// | speed | any | pixels scrolled per animation frame, which with the row height sets the churn |
import { Signal } from "@hafley66/signals"
import {
  grid,
  render,
  setGridLogEmit,
  type ColumnDef,
  type GridState,
  type Viewport,
} from "../../src/index.js"
import "../../src/theme.css"

const params = new URLSearchParams(location.search)
const num = (key: string, fallback: number): number => {
  const raw = params.get(key)
  const value = raw === null ? Number.NaN : Number(raw)
  return Number.isFinite(value) ? value : fallback
}
const flag = (key: string): boolean => params.get(key) === "1"

const ROWS = num("rows", 100_000)
const WIDTH = num("width", 1600)
const HEIGHT = num("height", 900)
const OVERSCAN = num("overscan", 4)
const SPEED = num("speed", 240)
const HEAVY = params.get("cell") === "heavy"
const VARIED = params.get("extent") === "varied"
const CV = flag("cv")

const ROW_PX = 36

interface BenchRow {
  readonly id: string
  readonly at: number
  readonly name: string
  readonly size: number
  readonly pct: number
  readonly spark: readonly number[]
}

const SPARK = 16
const hash = (n: number): number => {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** A proxy over an empty array: `Array.isArray` still answers true, `map` still walks it, and no
 * array of a million objects is ever held. The same trick `demo/5_sheet.ts` uses. */
const INDEX = /^\d+$/
const rowAt = (at: number): BenchRow => ({
  id: `r${at}`,
  at,
  name: `row ${at}`,
  size: Math.round(hash(at) * 100_000),
  pct: hash(at * 7),
  spark: Array.from({ length: SPARK }, (_value, i) => hash(at * 97 + i)),
})
const DATA: readonly BenchRow[] = new Proxy([] as BenchRow[], {
  get: (target, key) => {
    if (key === "length") return ROWS
    if (typeof key === "string" && INDEX.test(key)) {
      const at = Number(key)
      return at < ROWS ? rowAt(at) : undefined
    }
    return Reflect.get(target, key) as unknown
  },
  has: (target, key) =>
    typeof key === "string" && INDEX.test(key) ? Number(key) < ROWS : Reflect.has(target, key),
})

const el = (tag: string, cls: string): HTMLElement => {
  const node = document.createElement(tag)
  node.className = cls
  return node
}

const svg = (tag: string): SVGElement => document.createElementNS("http://www.w3.org/2000/svg", tag)

/** A sparkline as one `<rect>` per sample, so the node count is the point rather than the picture. */
const sparkline = (values: readonly number[]): SVGElement => {
  const chart = svg("svg")
  chart.setAttribute("viewBox", `0 0 ${SPARK * 4} 16`)
  chart.setAttribute("width", `${SPARK * 4}`)
  chart.setAttribute("height", "16")
  for (const [i, value] of values.entries()) {
    const bar = svg("rect")
    bar.setAttribute("x", String(i * 4))
    bar.setAttribute("y", String(16 - value * 16))
    bar.setAttribute("width", "3")
    bar.setAttribute("height", String(value * 16))
    chart.append(bar)
  }
  return chart
}

/** Nine elements in one cell against a plain text node's one, which is the whole of the `cell`
 * factor. Shaped after `demo/6_dense.ts` so the two are comparable. */
const heavyCell = (row: BenchRow, colId: string): HTMLElement => {
  const host = el("span", "b-stack")
  if (colId === "spark") {
    host.append(sparkline(row.spark))
    return host
  }
  if (colId === "pct") {
    const meter = el("span", "b-meter")
    const fill = el("span", "b-fill")
    fill.style.inlineSize = `${Math.round(row.pct * 100)}%`
    meter.append(fill)
    host.append(meter, el("span", "b-num"))
    ;(host.lastChild as HTMLElement).textContent = `${Math.round(row.pct * 100)}%`
    return host
  }
  const dot = el("span", "b-dot")
  const label = el("span", "b-label")
  label.textContent = String(colId === "name" ? row.name : row.size)
  const badge = el("span", "b-badge")
  badge.textContent = row.at % 3 === 0 ? "new" : "ok"
  host.append(dot, label, badge)
  return host
}

const COLUMNS: readonly ColumnDef<BenchRow>[] = [
  { id: "name", header: "Name", width: 220, value: (row) => row.name },
  { id: "size", header: "Size", type: "number", width: 120, value: (row) => row.size },
  { id: "pct", header: "Share", width: 160, value: (row) => row.pct },
  { id: "spark", header: "Trend", width: 100, value: (row) => row.spark.length },
  { id: "at", header: "Index", type: "number", width: 100, value: (row) => row.at },
]

const found = document.getElementById("mount")
if (found === null) throw new Error("bench page has no #mount")
const mount: HTMLElement = found
mount.style.inlineSize = `${WIDTH}px`
mount.style.blockSize = `${HEIGHT}px`

if (CV) {
  const style = document.createElement("style")
  // `auto` skips layout and paint for an off-screen row and the intrinsic size holds the scroller's
  // geometry. Only a buffer puts a held row off screen, so this factor needs `overscan` to move.
  style.textContent = `[data-route="g"] .sg-center .sg-row { content-visibility: auto; contain-intrinsic-size: auto ${ROW_PX}px }`
  document.head.append(style)
}

// Declared for every row, which is the ordinary consumer shape and the one that put 20,005 inline
// properties on the root before the writer learned to walk the drawn run.
const extent: Record<string, number> =
  VARIED
    ? Object.fromEntries(
        Array.from({ length: ROWS }, (_value, at) => [`r${at}`, ROW_PX + (at % 5) * 6] as const),
      )
    : {}

const viewport = Signal<Viewport>({ top: 0, left: 0, width: WIDTH, height: HEIGHT })

const g = grid<BenchRow>({
  id: "bench",
  rows: DATA,
  columns: COLUMNS,
  rowId: (row) => row.id,
  state: Signal<Partial<GridState>>({
    virtualize: { vertical: true, horizontal: false },
    density: "standard",
    rowHeight: extent,
  }),
  viewport,
  overscan: OVERSCAN,
  slots: HEAVY ? { cell: (ctx) => heavyCell(ctx.data as BenchRow, ctx.col) } : undefined,
})

render(g, mount)

const scroll = mount.querySelector(".sg-scroll")
if (scroll instanceof HTMLElement) {
  const observer = new ResizeObserver((entries) => {
    const box = entries[0]?.contentRect
    if (box === undefined) return
    viewport.$({ ...viewport.$(), width: box.width, height: box.height })
  })
  observer.observe(scroll)
}

export interface StageTotal {
  readonly stage: string
  readonly records: number
  readonly ms: number
}

export interface Run {
  readonly frames: number
  readonly p50: number
  readonly p95: number
  readonly worst: number
  readonly slow: number
  readonly held: number
  readonly nodes: number
  readonly styleBytes: number
  readonly stages: readonly StageTotal[]
}

const SLOW_MS = 32

/** One burst: `warm` frames discarded, then `frames` measured at `SPEED` px each. Stage totals come
 * off the package's LogTape surface, so a row says where the frame went and not only how long. */
async function run(warm: number, frames: number): Promise<Run> {
  const by = new Map<string, { records: number; ms: number }>()
  setGridLogEmit((category, _message, fields) => {
    const key = category.join(".")
    const held = by.get(key) ?? { records: 0, ms: 0 }
    held.records += 1
    held.ms += typeof fields["durationMs"] === "number" ? fields["durationMs"] : 0
    by.set(key, held)
  })
  const box = mount.querySelector(".sg-scroll")
  if (!(box instanceof HTMLElement)) throw new Error("bench page has no scroller")
  const gaps: number[] = []
  let previous = performance.now()
  let step = 0
  await new Promise<void>((resolve) => {
    const tick = (now: number): void => {
      gaps.push(now - previous)
      previous = now
      box.scrollTop += SPEED
      step += 1
      if (step === warm) by.clear()
      if (step < warm + frames) requestAnimationFrame(tick)
      else resolve()
    }
    requestAnimationFrame(tick)
  })
  setGridLogEmit(null)
  const measured = gaps.slice(warm)
  const sorted = [...measured].sort((a, b) => a - b)
  // `render` decorates the element it is handed, so the grid root is the mount and the inline
  // custom properties are on its own style attribute.
  const style = mount.getAttribute("style") ?? ""
  return {
    frames: measured.length,
    p50: sorted[Math.floor(sorted.length * 0.5)] ?? 0,
    p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
    worst: sorted[sorted.length - 1] ?? 0,
    slow: measured.filter((it) => it > SLOW_MS).length,
    held: mount.getElementsByClassName("sg-row").length,
    nodes: box.getElementsByTagName("*").length,
    styleBytes: style.length,
    stages: [...by].map(([stage, it]) => ({ stage, records: it.records, ms: it.ms })),
  }
}

declare global {
  interface Window {
    __bench: (warm: number, frames: number) => Promise<Run>
  }
}

window.__bench = run
