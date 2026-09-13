// @comment-ok: the driver table is the page, and each row names a knob plus the reason it belongs
// in a chaos run rather than in the one-factor-at-a-time matrix
//
// Every knob moving at once, on its own period, with no two periods sharing a factor, so the grid
// never sees the same combination twice inside a run. The matrix in `bench/README.md` answers what
// one factor costs. This answers whether the frame survives all of them plus real DOM events.
//
// | driver | period | what it moves |
// | scroll | 97 | the scroller, reversing at either stop |
// | box | 131 | the grid's own width and height, so the viewport signal is rewritten |
// | overscan | 53 | rows held past the viewport, the one factor that broke the frame alone |
// | density | 149 | the row height every drawn row reads |
// | sort | 181 | a comparator swap, which recuts the whole vertical axis |
// | colWidth | 67 | a track width, which is a layout on every rendered row |
// | colOrder | 211 | the horizontal run, which repaints every cell's seat |
// | colPinning | 173 | rows split across three runs instead of one |
// | colHidden | 127 | a column leaving and rejoining the run |
// | rowPinning | 191 | a pinned run above the centre, sized separately |
// | rowSelection | 29 | a moving band of selected rows |
// | range | 37 | a moving rectangle of selected cells |
// | focus | 17 | the focus ring, one cell per frame |
// | listView | 233 | the degenerate transpose, one cell per row |
// | hue | 71 | a CSS custom property every cell reads |
// | events | 23 | real pointer and keyboard events at the root, so the epics run |
import { createElement, type ReactNode } from "react"
import { setGridLogEmit } from "../../src/index.js"
import { cellId, type CellId, type ColId, type Side } from "../../src/0_types.js"
import { reactSlot } from "../../src/react/index.js"
import { COLUMNS, DEFAULTS, mountBench, ROW_PX, type BenchRow, type Cfg, type Mounted } from "./0_bench.js"
import { Heavy } from "./2_heavy.js"

const must = (id: string): HTMLElement => {
  const found = document.getElementById(id)
  if (found === null) throw new Error(`chaos page has no #${id}`)
  return found
}

const board = must("board")
const stage = must("stage")
const readout = must("readout")
const trace = must("trace") as HTMLCanvasElement

const cfg: Cfg = { ...DEFAULTS, rows: 200_000, width: 1180, height: 620, cell: "heavy", src: "proxy" }

let overscan = 4

interface CellProps {
  readonly data: BenchRow
  readonly col: string
  readonly value: unknown
}

// The slot is fixed when `grid()` is called, so switching writers is a rebuild rather than a knob.
// Everything else on this page survives it: the drivers read `mounted` and `state` through the
// bindings below, which the rebuild re-points.
const jsx = reactSlot<CellProps>((ctx: CellProps): ReactNode =>
  createElement(Heavy, { row: ctx.data, col: ctx.col }),
)

let cells: "dom" | "react" = "dom"
let mounted: Mounted = mountBench(stage, cfg, { overscan: () => overscan })
let state = mounted.state

function remount(): void {
  mounted.dispose()
  stage.replaceChildren()
  mounted = mountBench(
    stage,
    cfg,
    { overscan: () => overscan },
    cells === "react"
      ? (ctx) => jsx({ data: ctx.data as BenchRow, col: ctx.col, value: ctx.value })
      : undefined,
  )
  state = mounted.state
}

const COL_IDS: readonly ColId[] = COLUMNS.map((it) => it.id)

// A triangle rather than a sine for anything discrete: a sine spends most of its time near the
// extremes, and a knob with four levels would sit on two of them.
const tri = (phase: number): number => (phase < 0.5 ? phase * 2 : 2 - phase * 2)

/** Churn on: every driver rewrites its signal each frame with a fresh object that is equal to the
 * one already there. Off: it writes only when the value changed, which is what an application does. */
export let churn = false
export const setChurn = (on: boolean): void => { churn = on }

// A signal holding a structure rejects an equal value by identity, not by shape, so a driver that
// rebuilds `[{ field, sort }]` every frame re-sorts the relation every frame. The guard is the
// consumer's job, and the `churn` switch is what makes that cost visible instead of assumed.
const same = (a: unknown, b: unknown): boolean => a === b || JSON.stringify(a) === JSON.stringify(b)
const put = <T,>(signal: { $: { (): T; (next: T): void } }, next: T): void => {
  if (!churn && same(signal.$(), next)) return
  signal.$(next)
}
const pick = <T,>(list: readonly T[], at: number): T => list[at % list.length] as T

interface Driver {
  readonly name: string
  readonly period: number
  /** `frame` runs every frame and reads its phase off the period, which is how a continuous knob
   * moves. `period` fires once per period, which is how a user's click arrives. */
  readonly every: "frame" | "period"
  /** Starts switched off. A driver whose cost is the point of the page rather than part of its
   * baseline, so the run it opens with is the one an application could produce. */
  readonly off?: boolean
  readonly run: (phase: number, at: number) => string
}

const SIDES: readonly (Side | undefined)[] = ["start", "end", undefined]
const DENSITY = ["compact", "standard", "comfortable"] as const
const KEYS = ["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft", "Enter", "Escape", " "] as const

const rowAtTop = (): number => Math.floor(mounted.scroll.scrollTop / ROW_PX)

const DRIVERS: readonly Driver[] = [
  {
    name: "scroll",
    period: 97,
    every: "frame",
    run: (phase, at) => {
      const span = mounted.scroll.scrollHeight - mounted.scroll.clientHeight
      // A sweep, not a teleport. A triangle over the whole scroller moves 8,000 px a frame, which
      // shares no row with the frame before it and measures a cold mount 60 times a second.
      const speed = 120 + tri(phase) * 760
      const jump = at % 419 === 0
      const next = jump
        ? Math.round(Math.random() * span)
        : mounted.scroll.scrollTop + (phase < 0.5 ? speed : -speed)
      mounted.scroll.scrollTop = Math.max(0, Math.min(span, next))
      return jump ? `jump ${Math.round(mounted.scroll.scrollTop)}` : `${Math.round(speed)} px/f`
    },
  },
  {
    name: "box",
    period: 131,
    every: "frame",
    run: (phase) => {
      const wave = 0.72 + tri(phase) * 0.28
      const w = Math.round(cfg.width * wave)
      const h = Math.round(cfg.height * (0.8 + tri(phase) * 0.2))
      stage.style.inlineSize = `${w}px`
      stage.style.blockSize = `${h}px`
      return `${w}x${h}`
    },
  },
  {
    name: "overscan",
    period: 53,
    every: "frame",
    run: (phase) => {
      overscan = Math.round(tri(phase) * 48)
      return String(overscan)
    },
  },
  {
    name: "density",
    period: 149,
    every: "period",
    run: (_phase, at) => {
      const next = pick(DENSITY, Math.floor(at / 149))
      put(state.density, next)
      return next
    },
  },
  {
    name: "sort",
    period: 181,
    every: "period",
    run: (_phase, at) => {
      const step = Math.floor(at / 181) % (COL_IDS.length * 2 + 1)
      if (step === COL_IDS.length * 2) {
        put(state.sort, [])
        return "none"
      }
      const col = pick(COL_IDS, Math.floor(step / 2))
      const dir = step % 2 === 0 ? "asc" : "desc"
      put(state.sort, [{ field: col, sort: dir }])
      return `${col} ${dir}`
    },
  },
  {
    name: "colWidth",
    period: 67,
    every: "period",
    // One committed width per period, which is what a real resize writes: `DEFAULT_DRAG_MODE` is
    // `preview`, so `resizeOnHeaderDrag` leaves every width alone and writes once on the lift.
    run: (_phase, at) => {
      const col = pick(COL_IDS, Math.floor(at / 67))
      const width = 80 + ((Math.floor(at / 67) * 57) % 220)
      put(state.colWidth, { ...state.colWidth.$(), [col]: width })
      return `${col} ${width}`
    },
  },
  {
    name: "colWidthLive",
    period: 67,
    every: "frame",
    off: true,
    // The same resize written every frame instead of once on the lift. Alone it takes the page from
    // 120 fps to 38 and 101 slow frames of 193, at 1.28 ms/f of package time, so the cost is one
    // browser layout per frame rather than anything the package does.
    run: (phase, at) => {
      const col = pick(COL_IDS, Math.floor(at / 67))
      const width = Math.round(80 + tri(phase) * 220)
      put(state.colWidth, { ...state.colWidth.$(), [col]: width })
      return `${col} ${width}`
    },
  },
  {
    name: "colOrder",
    period: 211,
    every: "period",
    run: (_phase, at) => {
      const turn = Math.floor(at / 211) % COL_IDS.length
      const next = [...COL_IDS.slice(turn), ...COL_IDS.slice(0, turn)]
      put(state.colOrder, next)
      return next.join(",")
    },
  },
  {
    name: "colPinning",
    period: 173,
    every: "period",
    run: (_phase, at) => {
      const turn = Math.floor(at / 173)
      const col = pick(COL_IDS, turn)
      const side = pick(SIDES, turn)
      const next = { ...state.colPinning.$() }
      if (side === undefined) delete next[col]
      else next[col] = side
      put(state.colPinning, next)
      return side === undefined ? `${col} free` : `${col} ${side}`
    },
  },
  {
    name: "colHidden",
    period: 127,
    every: "period",
    run: (phase, at) => {
      const col = pick(COL_IDS, Math.floor(at / 127))
      const hide = phase < 0.35
      const next = { ...state.colHidden.$() }
      if (hide) next[col] = true
      else delete next[col]
      put(state.colHidden, next)
      return hide ? `${col} hidden` : "all shown"
    },
  },
  {
    name: "rowPinning",
    period: 191,
    every: "period",
    run: (_phase, at) => {
      // Fixed rows, not whatever is under the scroll. A pin follows a user's click, and pinning the
      // moving top rewrites the row axis every frame, which is a full base replan of the relation.
      const turn = Math.floor(at / 191) % 3
      if (turn === 2) {
        put(state.rowPinning, {})
        return "none"
      }
      const base = turn * 1000
      const keys = [`r${base}`, `r${base + 1}`]
      put(state.rowPinning, Object.fromEntries(keys.map((k) => [k, turn === 0 ? "start" : "end"] as const)))
      return `${keys.length} ${turn === 0 ? "start" : "end"}`
    },
  },
  {
    name: "rowSelection",
    period: 29,
    every: "frame",
    run: (phase) => {
      const top = rowAtTop() + Math.round(tri(phase) * 12)
      const band = Object.fromEntries(
        Array.from({ length: 6 }, (_value, i) => [`r${top + i}`, true] as const),
      )
      put(state.rowSelection, band)
      return `6 from r${top}`
    },
  },
  {
    name: "range",
    period: 37,
    every: "frame",
    run: (phase) => {
      const top = rowAtTop() + Math.round(tri(phase) * 8)
      const wide = 1 + Math.round(tri(phase) * (COL_IDS.length - 1))
      const anchor = cellId(`r${top}`, pick(COL_IDS, 0))
      const head = cellId(`r${top + 3}`, pick(COL_IDS, wide - 1))
      put(state.selection, { anchor, head, mode: "cell", blocks: [] })
      return `r${top} x ${wide}`
    },
  },
  {
    name: "focus",
    period: 17,
    every: "frame",
    run: (phase, at) => {
      const top = rowAtTop() + Math.round(tri(phase) * 10)
      const id: CellId = cellId(`r${top}`, pick(COL_IDS, at))
      put(state.focus, id)
      return `r${top}`
    },
  },
  {
    name: "listView",
    period: 233,
    every: "period",
    run: (phase) => {
      const on = phase > 0.78
      put(state.listView, on)
      return on ? "on" : "off"
    },
  },
  {
    name: "hue",
    period: 71,
    every: "frame",
    run: (phase) => {
      const deg = Math.round(tri(phase) * 360)
      stage.style.setProperty("--sg-focus", `hsl(${deg} 80% 62%)`)
      stage.style.setProperty("--sg-selected-bg", `hsl(${deg} 40% 22%)`)
      return `${deg}deg`
    },
  },
  {
    name: "events",
    period: 23,
    every: "period",
    run: (_phase, at) => {
      const cells = stage.getElementsByClassName("sg-cell")
      const target = cells[at % Math.max(1, cells.length)]
      if (!(target instanceof HTMLElement)) return "no cell"
      const opts = { bubbles: true, cancelable: true, composed: true } as const
      target.dispatchEvent(new PointerEvent("pointerdown", { ...opts, button: 0, pointerId: 1 }))
      target.dispatchEvent(new PointerEvent("pointerup", { ...opts, button: 0, pointerId: 1 }))
      target.dispatchEvent(new MouseEvent("click", { ...opts, button: 0 }))
      const key = pick(KEYS, Math.floor(at / 23))
      stage.dispatchEvent(new KeyboardEvent("keydown", { ...opts, key }))
      return `click + ${key === " " ? "Space" : key}`
    },
  },
]

const cards = new Map<string, HTMLElement>()
const off = new Set<string>(DRIVERS.filter((it) => it.off === true).map((it) => it.name))
for (const driver of DRIVERS) {
  const card = document.createElement("div")
  card.className = off.has(driver.name) ? "d-card d-off" : "d-card"
  card.innerHTML = `<b>${driver.name}</b><span class="d-p">${driver.every === "frame" ? "1f" : `${driver.period}f`}</span><i class="d-v">idle</i>`
  // Click a driver off to see what it was costing. The readout splits the package's own stage total
  // from the frame it rides in, so switching one off names its share of the browser's half too.
  card.addEventListener("click", () => {
    if (off.has(driver.name)) off.delete(driver.name)
    else off.add(driver.name)
    card.classList.toggle("d-off", off.has(driver.name))
    at = 0
    slow = 0
    times.length = 0
  })
  board.append(card)
  cards.set(driver.name, card.getElementsByClassName("d-v")[0] as HTMLElement)
}

// Folded per stage from the one global sink, so the readout separates the package's own cost from
// the frame it rides in without a second instrumentation path.
let pkgMs = 0
const byStage = new Map<string, number>()
setGridLogEmit((category, _message, fields) => {
  const ms = typeof fields["durationMs"] === "number" ? fields["durationMs"] : 0
  pkgMs += ms
  const key = category[category.length - 1] ?? "?"
  byStage.set(key, (byStage.get(key) ?? 0) + ms)
})

const TRACE = 360
const times: number[] = []
let running = false
let at = 0
let frames = 0
let slow = 0
let since = performance.now()
let previous = performance.now()
let fps = 0
let mean = 0
let p95 = 0
let pkgPerFrame = 0
let stages = ""
let share = 0

const ctx = trace.getContext("2d")

const paintTrace = (): void => {
  if (ctx === null) return
  const w = trace.width
  const h = trace.height
  ctx.clearRect(0, 0, w, h)
  ctx.strokeStyle = "#2a2f36"
  for (const line of [8.3, 16.6, 33]) {
    const y = h - (line / 50) * h
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }
  ctx.beginPath()
  for (const [i, ms] of times.entries()) {
    const x = (i / TRACE) * w
    const y = h - Math.min(1, ms / 50) * h
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.strokeStyle = "#6fd7ad"
  ctx.lineWidth = 1
  ctx.stroke()
}

const mb = (bytes: number | undefined): string =>
  bytes === undefined ? "n/a" : `${(bytes / 1024 ** 2).toFixed(0)} MB`

const paint = (): void => {
  const heap = (performance as { memory?: { usedJSHeapSize?: number } }).memory
  const rows = stage.getElementsByClassName("sg-row").length
  const nodes = stage.getElementsByTagName("*").length
  // A cell with no content is a cell whose writer has not committed yet. React's concurrent root
  // defers that commit off the animation frame, so a moving grid can report a frame rate for rows
  // that are empty; counting the filled ones is the only way the readout cannot lie.
  const total = stage.getElementsByClassName("sg-cell").length
  const filled = stage.querySelectorAll(".sg-cell .b-stack").length
  const bare = total > 0 && filled * 4 < total
  readout.innerHTML =
    `<b>${fps.toFixed(0)} fps</b> ${mean.toFixed(1)} ms mean, p95 ${p95.toFixed(1)} ms` +
    ` &middot; <b class="${slow === 0 ? "ok" : "bad"}">${slow}</b> frames over 32 ms of ${at}` +
    ` &middot; <b>package ${pkgPerFrame.toFixed(2)} ms/f</b>, ${share.toFixed(0)}% of the frame (${stages})` +
    ` &middot; ${rows} rows, ${nodes} nodes` +
    ` &middot; <b class="${bare ? "bad" : "ok"}">${filled} of ${total}</b> cells filled` +
    ` &middot; <b>${cells === "react" ? "reactSlot" : "DOM"}</b> writer` +
    ` &middot; heap ${mb(heap?.usedJSHeapSize)}`
}

const tick = (now: number): void => {
  const gap = now - previous
  previous = now
  if (running) {
    times.push(gap)
    if (times.length > TRACE) times.shift()
    if (gap > 32) slow += 1
    frames += 1
    at += 1
    for (const driver of DRIVERS) {
      if (off.has(driver.name)) continue
      if (driver.every === "period" && at % driver.period !== 0) continue
      const value = driver.run((at % driver.period) / driver.period, at)
      const card = cards.get(driver.name)
      if (card !== undefined) card.textContent = value
    }
  }
  if (now - since >= 500) {
    const window = times.slice(-120).sort((a, b) => a - b)
    fps = (frames * 1000) / (now - since)
    mean = window.reduce((carry, it) => carry + it, 0) / Math.max(1, window.length)
    p95 = window[Math.floor(window.length * 0.95)] ?? 0
    pkgPerFrame = pkgMs / Math.max(1, frames)
    share = mean === 0 ? 0 : (pkgPerFrame / mean) * 100
    stages = [...byStage]
      .map(([name, ms]) => [name, ms / Math.max(1, frames)] as const)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name, ms]) => `${name} ${ms.toFixed(1)}`)
      .join(", ")
    byStage.clear()
    pkgMs = 0
    frames = 0
    since = now
    paint()
    paintTrace()
  }
  requestAnimationFrame(tick)
}

const toggle = must("toggle")
toggle.addEventListener("click", () => {
  running = !running
  toggle.textContent = running ? "pause" : "run"
})
const cellsBox = must("cells") as HTMLInputElement
cellsBox.addEventListener("change", () => {
  cells = cellsBox.checked ? "react" : "dom"
  remount()
  at = 0
  slow = 0
  times.length = 0
})

const churnBox = must("churn") as HTMLInputElement
churnBox.addEventListener("change", () => {
  setChurn(churnBox.checked)
  at = 0
  slow = 0
  times.length = 0
})
must("reset").addEventListener("click", () => {
  at = 0
  slow = 0
  times.length = 0
})

paint()
requestAnimationFrame(tick)
