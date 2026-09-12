// @comment-ok: the factor list this bench exists to vary, and why each one is a factor, with no
// runtime home outside the matrix and the gallery it feeds
//
// One mount function, every factor in a plain object, so a run differs from its neighbour in
// exactly one place. `main.ts` reads the factors off a query string and `gallery.ts` mounts several
// at once; `bench/scroll.mjs` walks the matrix and `bench/README.md` records what came back.
//
// | factor | levels | why it is a factor |
// | rows | any | the relation the window is cut from |
// | width, height | any | the viewport, which with the row height sets how many rows are held |
// | cell | plain, heavy | build cost per row: one text node against a chart, a meter and a stack |
// | extent | uniform, varied | whether the consumer declares a height per row |
// | overscan | any | rows held beyond the viewport on each side |
// | cv | 0, 1 | `content-visibility: auto` on the rendered rows |
// | resize | 0, 1 | the grid box itself changing size every frame, not only its contents |
import { Signal } from "@hafley66/signals"
import {
  grid,
  render,
  type ColumnDef,
  type GridState,
  type Viewport,
} from "../../src/index.js"
import "../../src/theme.css"

export interface Cfg {
  readonly rows: number
  readonly width: number
  readonly height: number
  readonly overscan: number
  readonly cell: "plain" | "heavy"
  readonly extent: "uniform" | "varied"
  readonly cv: 0 | 1
  readonly resize: 0 | 1
}

export const DEFAULTS: Cfg = {
  rows: 100_000,
  width: 1600,
  height: 900,
  overscan: 4,
  cell: "heavy",
  extent: "uniform",
  cv: 0,
  resize: 0,
}

export const ROW_PX = 36

export const cfgOf = (params: URLSearchParams): Cfg => {
  const num = (key: string, fallback: number): number => {
    const raw = params.get(key)
    const value = raw === null ? Number.NaN : Number(raw)
    return Number.isFinite(value) ? value : fallback
  }
  return {
    rows: num("rows", DEFAULTS.rows),
    width: num("width", DEFAULTS.width),
    height: num("height", DEFAULTS.height),
    overscan: num("overscan", DEFAULTS.overscan),
    cell: params.get("cell") === "plain" ? "plain" : "heavy",
    extent: params.get("extent") === "varied" ? "varied" : "uniform",
    cv: params.get("cv") === "1" ? 1 : 0,
    resize: params.get("resize") === "1" ? 1 : 0,
  }
}

export const queryOf = (cfg: Cfg): string =>
  `rows=${cfg.rows}&width=${cfg.width}&height=${cfg.height}&overscan=${cfg.overscan}` +
  `&cell=${cfg.cell}&extent=${cfg.extent}&cv=${cfg.cv}&resize=${cfg.resize}`

export interface BenchRow {
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

const rowAt = (at: number): BenchRow => ({
  id: `r${at}`,
  at,
  name: `row ${at}`,
  size: Math.round(hash(at) * 100_000),
  pct: hash(at * 7),
  spark: Array.from({ length: SPARK }, (_value, i) => hash(at * 97 + i)),
})

/** A proxy over an empty array: `Array.isArray` still answers true, `map` still walks it, and no
 * array of a million objects is ever held. The same trick `demo/5_sheet.ts` uses. */
const INDEX = /^\d+$/
const dataOf = (rows: number): readonly BenchRow[] =>
  new Proxy([] as BenchRow[], {
    get: (target, key) => {
      if (key === "length") return rows
      if (typeof key === "string" && INDEX.test(key)) {
        const at = Number(key)
        return at < rows ? rowAt(at) : undefined
      }
      return Reflect.get(target, key) as unknown
    },
    has: (target, key) =>
      typeof key === "string" && INDEX.test(key) ? Number(key) < rows : Reflect.has(target, key),
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
    const num = el("span", "b-num")
    num.textContent = `${Math.round(row.pct * 100)}%`
    host.append(meter, num)
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

let cvOnce = false
const enableCv = (): void => {
  if (cvOnce) return
  cvOnce = true
  const style = document.createElement("style")
  // `auto` skips layout and paint for an off-screen row and the intrinsic size holds the scroller's
  // geometry. Only a buffer puts a held row off screen, so this factor needs `overscan` to move.
  style.textContent = `.b-cv .sg-center .sg-row { content-visibility: auto; contain-intrinsic-size: auto ${ROW_PX}px }`
  document.head.append(style)
}

export interface Mounted {
  /** The grid id every LogTape record carries, so a page running several folds cost per tile. */
  readonly id: string
  readonly host: HTMLElement
  readonly scroll: HTMLElement
  /** Advances the scroll by one frame's worth, and resizes the box when that factor is on. */
  readonly step: (px: number, at: number) => void
  readonly dispose: () => void
}

// The grid box oscillating rather than a fixed one. Every step writes a new width and height, so
// the ResizeObserver writes the viewport signal and the window is recut on a box that moved.
// Centred on the declared size, not shrunk toward it: a box that averaged 0.75x would hold fewer
// rows than its fixed twin and the comparison would be measuring the smaller box.
const RESIZE_SPAN = 0.25
const RESIZE_PERIOD = 40

let seq = 0

export function mountBench(host: HTMLElement, cfg: Cfg): Mounted {
  host.style.inlineSize = `${cfg.width}px`
  host.style.blockSize = `${cfg.height}px`
  if (cfg.cv === 1) {
    enableCv()
    host.classList.add("b-cv")
  }
  // Declared for every row, which is the ordinary consumer shape and the one that put 20,005 inline
  // properties on the root before the writer learned to walk the drawn run.
  const extent: Record<string, number> =
    cfg.extent === "varied"
      ? Object.fromEntries(
          Array.from({ length: cfg.rows }, (_value, at) => [`r${at}`, ROW_PX + (at % 5) * 6] as const),
        )
      : {}
  const viewport = Signal<Viewport>({ top: 0, left: 0, width: cfg.width, height: cfg.height })
  seq += 1
  const id = `bench${seq}`
  const g = grid<BenchRow>({
    id,
    rows: dataOf(cfg.rows),
    columns: COLUMNS,
    rowId: (row) => row.id,
    state: Signal<Partial<GridState>>({
      virtualize: { vertical: true, horizontal: false },
      density: "standard",
      rowHeight: extent,
    }),
    viewport,
    overscan: cfg.overscan,
    slots: cfg.cell === "heavy" ? { cell: (ctx) => heavyCell(ctx.data as BenchRow, ctx.col) } : undefined,
  })
  const handle = render(g, host)
  const scroll = host.querySelector(".sg-scroll")
  if (!(scroll instanceof HTMLElement)) throw new Error("bench mount has no scroller")
  const observer = new ResizeObserver((entries) => {
    const box = entries[0]?.contentRect
    if (box === undefined) return
    viewport.$({ ...viewport.$(), width: box.width, height: box.height })
  })
  observer.observe(scroll)
  const step = (px: number, at: number): void => {
    if (cfg.resize === 1) {
      const wave = 1 + Math.sin((at / RESIZE_PERIOD) * Math.PI * 2) * RESIZE_SPAN
      host.style.inlineSize = `${Math.round(cfg.width * wave)}px`
      host.style.blockSize = `${Math.round(cfg.height * wave)}px`
    }
    scroll.scrollTop += px
  }
  return {
    id,
    host,
    scroll,
    step,
    dispose: () => {
      observer.disconnect()
      handle.stop()
    },
  }
}
