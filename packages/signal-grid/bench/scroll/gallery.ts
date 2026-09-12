// Every factor level from `bench/README.md` running at once, in one animation frame, so the cost
// that a table reports as a number is on screen as a moving grid. The tiles share the frame on
// purpose: a page-level fps plus a per-tile stage cost is what a real application looks like.
import { setGridLogEmit } from "../../src/index.js"
import { DEFAULTS, mountBench, type Cfg, type Mounted } from "./0_bench.js"

// 100k rather than the matrix baseline of 1M: ten tiles at 1M retain about 2.6 GB between them,
// which is the memory table's own finding turned into an unusable page.
const cfg = (patch: Partial<Cfg>): Cfg => ({ ...DEFAULTS, rows: 100_000, width: 520, height: 300, ...patch })

interface Tile {
  readonly label: string
  readonly note: string
  readonly cfg: Cfg
}

const TILES: readonly Tile[] = [
  { label: "baseline", note: "100k rows, heavy cells, overscan 4", cfg: cfg({}) },
  { label: "plain cells", note: "one text node per cell", cfg: cfg({ cell: "plain" }) },
  { label: "overscan 0", note: "no buffer past the viewport", cfg: cfg({ overscan: 0 }) },
  { label: "overscan 96", note: "the buffer that breaks the frame", cfg: cfg({ overscan: 96 }) },
  { label: "overscan 96 + content-visibility", note: "the only cell the property rescues", cfg: cfg({ overscan: 96, cv: 1 }) },
  { label: "varied row heights", note: "a declared height for every row", cfg: cfg({ extent: "varied" }) },
  { label: "1M rows", note: "ten times the relation, same window", cfg: cfg({ rows: 1_000_000 }) },
  { label: "small box", note: "320 x 190 viewport", cfg: cfg({ width: 320, height: 190 }) },
  { label: "large box", note: "900 x 420 viewport", cfg: cfg({ width: 900, height: 420 }) },
  { label: "resizing box", note: "the grid itself changing size every frame", cfg: cfg({ resize: 1 }) },
]

const el = (tag: string, cls: string): HTMLElement => {
  const node = document.createElement(tag)
  node.className = cls
  return node
}

const boardFound = document.getElementById("board")
const readoutFound = document.getElementById("readout")
if (boardFound === null || readoutFound === null) throw new Error("gallery page has no #board or #readout")
const board: HTMLElement = boardFound
const readout: HTMLElement = readoutFound

interface Live {
  readonly tile: Tile
  readonly mounted: Mounted
  readonly stats: HTMLElement
  readonly card: HTMLElement
}

const live: Live[] = []
// Clicking a tile's header runs that one alone, which is the only way to read a frame rate against
// a single factor: the ten share one animation frame by design.
let solo: number | null = null
for (const tile of TILES) {
  const card = el("section", "b-card")
  const head = el("header", "b-head")
  head.innerHTML = `<b>${tile.label}</b><span>${tile.note}</span>`
  const host = el("div", "b-host")
  const stats = el("div", "b-stats")
  card.append(head, host, stats)
  board.append(card)
  const index = live.length
  head.addEventListener("click", () => {
    solo = solo === index ? null : index
    for (const [i, it] of live.entries()) it.card.classList.toggle("b-dim", solo !== null && solo !== i)
  })
  live.push({ tile, mounted: mountBench(host, tile.cfg), stats, card })
}

// Folded per grid id, which every record in `0_log.ts` carries, so one global sink answers for ten
// tiles. Reset each second so the readout is the last second's cost, not the run's.
const cost = new Map<string, number>()
setGridLogEmit((_category, _message, fields) => {
  const id = String(fields["id"] ?? "")
  const ms = typeof fields["durationMs"] === "number" ? fields["durationMs"] : 0
  cost.set(id, (cost.get(id) ?? 0) + ms)
})

interface HeapSource {
  readonly usedJSHeapSize?: number
  readonly totalJSHeapSize?: number
  readonly jsHeapSizeLimit?: number
}
const memory = (): HeapSource => (performance as { memory?: HeapSource }).memory ?? {}
const mb = (bytes: number | undefined): string => (bytes === undefined ? "n/a" : (bytes / 1024 ** 2).toFixed(1) + " MB")

// bench/scroll.mjs drives 240 px/frame to stress the window; this page shows ordinary scroll speed.
const SPEED = 60
// Paused on load. Ten grids at 100k rows each retain a few hundred megabytes and hold the frame at
// about 15 fps, which a docs page should ask for rather than start doing.
let running = false
let at = 0
let frames = 0
let since = performance.now()
let fps = 0
let worst = 0
let previous = performance.now()

const tick = (now: number): void => {
  const gap = now - previous
  previous = now
  if (running) {
    if (gap > worst) worst = gap
    for (const [i, it] of live.entries()) if (solo === null || solo === i) it.mounted.step(SPEED, at)
    at += 1
    frames += 1
  }
  if (now - since >= 1000) {
    fps = (frames * 1000) / (now - since)
    paint()
    frames = 0
    since = now
    worst = 0
    cost.clear()
  }
  requestAnimationFrame(tick)
}

function paint(): void {
  const heap = memory()
  const nodes = document.getElementsByTagName("*").length
  readout.innerHTML =
    `<b>${fps.toFixed(1)} fps</b> worst frame ${worst.toFixed(1)} ms` +
    ` &middot; heap ${mb(heap.usedJSHeapSize)} of ${mb(heap.jsHeapSizeLimit)}` +
    ` &middot; ${nodes} nodes on the page` +
    ` &middot; ${solo === null ? `${live.length} grids` : `solo: ${live[solo]?.tile.label ?? ""}`}`
  for (const it of live) {
    const rows = it.mounted.host.getElementsByClassName("sg-row").length
    const count = it.mounted.scroll.getElementsByTagName("*").length
    const ms = cost.get(it.mounted.id) ?? 0
    const share = Math.min(100, (ms / Math.max(1, fps)) * 100)
    it.stats.innerHTML =
      `<span>${rows} rows</span><span>${count} nodes</span><span>${(ms / Math.max(1, fps)).toFixed(2)} ms/f</span>` +
      `<span class="b-bar"><i style="inline-size:${share.toFixed(0)}%"></i></span>`
  }
}

const toggle = document.getElementById("toggle")
if (toggle !== null) {
  toggle.addEventListener("click", () => {
    running = !running
    toggle.textContent = running ? "pause" : "run"
  })
}

requestAnimationFrame(tick)
