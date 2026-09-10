// Every number is read from a generated file: `site/stats.json` and `docs/1_parity.md`.
// The head-to-head table is two live grids, one per orientation, so the page is its own claim.
import "./pitch.css"
import { Signal } from "@hafley66/signals"
import parityRaw from "../docs/1_parity.md?raw"
import {
  grid,
  render,
  type CellCtx,
  type ColumnDef,
  type GridState,
  type Renderable,
  type Viewport,
} from "../src/index.js"
import type { Heading } from "./md.js"
import { formatBytes, STATS } from "./stats.js"

export interface PitchMount {
  readonly headings: readonly Heading[]
  readonly teardown: () => void
}

const el = (tag: string, className: string, text?: string): HTMLElement => {
  const node = document.createElement(tag)
  if (className !== "") node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

const code = (text: string): HTMLElement => el("code", "pitch-code", text)

// --- The four claims --------------------------------------------------------

interface Claim {
  readonly claim: string
  readonly receipt: readonly string[]
  readonly note: string
}

const CLAIMS: readonly Claim[] = [
  {
    claim: "One operator flattens both forests",
    receipt: ["src/1_axis.ts:361", "src/8_grid.ts:327", "src/8_grid.ts:370"],
    note: "flattenAxis runs over the row forest at 8_grid.ts:327 and over the column forest at :370. Same function, same signature, one Axis<K, T> for both.",
  },
  {
    claim: "No branch on orientation exists in src/",
    receipt: ["src/12_transpose.ts:27", "src/12_transpose.ts:32"],
    note: "state.orientation swaps which axis scrolls. Two lookup tables carry it, SEATS and FLIPPED. The grep that proves it prints nothing and exits 1.",
  },
  {
    claim: "A 2 by 3 span transposes to 3 by 2 and the covered set swaps with it",
    receipt: ["src/12_transpose.test.ts:190", "src/12_transpose.test.ts:212"],
    note: "The acceptance test names the shape it asserts. :203 also checks that transposing the relation by hand lands on the relation the transposed grid built.",
  },
  {
    claim: "No layout algorithm",
    receipt: ["src/4_slice.ts:247", "src/8_grid.ts:426"],
    note: "trackList emits one grid-template-columns value with fr and minmax(), and the browser distributes. The pixel solver it replaced is deleted, docs/5_tests.md:246.",
  },
]

const GREP = 'grep -rnE "if *\\(.*orientation|orientation *===|orientation *!==" src/'

// --- Parity, read back out of the generated matrix --------------------------

interface ParityCounts {
  readonly tracked: number
  readonly tanstack: number
  readonly muiFull: number
  readonly muiPart: number
  readonly implemented: number
  readonly declared: number
}

function parityCounts(): ParityCounts | null {
  const found =
    /(\d+) features tracked\. TanStack Table v9 covers (\d+), MUI X Data Grid covers (\d+) in full and (\d+) in part, signal-grid implements (\d+) and declares a further (\d+)/.exec(
      parityRaw,
    )
  if (found === null) return null
  const at = (index: number): number => Number(found[index] ?? "0")
  return {
    tracked: at(1),
    tanstack: at(2),
    muiFull: at(3),
    muiPart: at(4),
    implemented: at(5),
    declared: at(6),
  }
}

/** The ids under "Cut on purpose", read off the generated table rather than restated. */
function cutFeatures(): readonly string[] {
  const start = parityRaw.indexOf("## Cut on purpose")
  if (start === -1) return []
  const rest = parityRaw.slice(start)
  const end = rest.indexOf("\n## ", 1)
  const section = end === -1 ? rest : rest.slice(0, end)
  const ids: string[] = []
  for (const line of section.split("\n")) {
    const row = /^\|\s*`([a-z][a-z.]*)`\s*\|/.exec(line)
    if (row !== null && row[1] !== undefined) ids.push(row[1])
  }
  return ids
}

// --- The live grid ----------------------------------------------------------

interface BenchRowView {
  readonly key: string
  readonly operation: string
  readonly ours: string
  readonly theirs: string
  readonly ratio: string
  readonly side: string
}

function benchRows(): readonly BenchRowView[] {
  const rows = STATS.bench.headToHead
  if (rows === null) return []
  // The key is a prefix of the operation, because under the transpose it is what the header reads.
  const taken = new Set<string>()
  return rows.map((row, index) => {
    const prefix = (row.operation.split(/,\s/)[0] ?? row.operation).trim()
    const key = prefix === "" || taken.has(prefix) ? `${prefix} (${index + 1})` : prefix
    taken.add(key)
    return {
      key,
      operation: row.operation,
      ours: row.signalGridMedian,
      theirs: row.tanstackMedian,
      ratio: row.ratio,
      side: row.ratio.endsWith("theirs") ? "theirs" : "ours",
    }
  })
}

const BENCH_COLUMNS: readonly ColumnDef<BenchRowView>[] = [
  { id: "operation", header: "Operation", type: "string", width: 300, resizable: true },
  { id: "ours", header: "signal-grid", type: "string", width: 120, resizable: true },
  { id: "theirs", header: "table-core", type: "string", width: 120, resizable: true },
  { id: "ratio", header: "Ratio", type: "string", width: 140, resizable: true },
]

function benchCell(ctx: CellCtx<BenchRowView>): Renderable {
  const text = String(ctx.value ?? "")
  if (ctx.col !== "ratio") return text
  return el("span", `pitch-ratio pitch-ratio-${ctx.data.side}`, text)
}

function mountBench(gridHost: HTMLElement, rows: readonly BenchRowView[]): () => void {
  const box = gridHost.getBoundingClientRect()
  const viewport = Signal<Viewport>({
    top: 0,
    left: 0,
    width: Math.round(box.width),
    height: Math.round(box.height),
  })

  const g = grid<BenchRowView>({
    id: "pitch",
    rows,
    columns: BENCH_COLUMNS,
    rowId: (row) => row.key,
    state: Signal<Partial<GridState>>({ virtualize: false, orientation: "rows" }),
    viewport,
    slots: { cell: benchCell },
  })

  const handle = render(g, gridHost)
  const unbind = g.bind(gridHost)

  const scroll = gridHost.querySelector(".sg-scroll")
  const observer = new ResizeObserver((entries) => {
    const rect = entries[0]?.contentRect
    if (rect === undefined) return
    viewport.$({ ...viewport.$(), width: rect.width, height: rect.height })
    g.dispatch({ phase: "intent", type: "viewport.resize", width: rect.width, height: rect.height })
  })
  const onScroll = (): void => {
    if (!(scroll instanceof HTMLElement)) return
    viewport.$({ ...viewport.$(), top: scroll.scrollTop, left: scroll.scrollLeft })
    g.dispatch({ phase: "intent", type: "viewport.scroll", top: scroll.scrollTop, left: scroll.scrollLeft })
  }
  if (scroll instanceof HTMLElement) {
    observer.observe(scroll)
    scroll.addEventListener("scroll", onScroll, { passive: true })
  }
  // The arrow keys belong to the `keyboardNav` epic, so the scroll box does not also take them.
  const onKey = (event: KeyboardEvent): void => {
    if (event.key.startsWith("Arrow")) event.preventDefault()
  }
  gridHost.addEventListener("keydown", onKey)

  return () => {
    observer.disconnect()
    if (scroll instanceof HTMLElement) scroll.removeEventListener("scroll", onScroll)
    gridHost.removeEventListener("keydown", onKey)
    unbind()
    handle.stop()
  }
}

// --- The page ---------------------------------------------------------------

export function renderPitchPage(host: HTMLElement): PitchMount {
  const headings: Heading[] = []
  const page = el("article", "pitch")
  // Live before the grids mount, so `getBoundingClientRect` on the grid host is a real measurement.
  host.append(page)

  const section = (id: string, title: string): HTMLElement => {
    const wrap = el("section", "pitch-section")
    const head = el("h2", "pitch-h2", title)
    head.id = id
    headings.push({ level: 2, text: title, id })
    wrap.append(head)
    page.append(wrap)
    return wrap
  }

  // 1. The headline.
  const lede = el("header", "pitch-lede")
  const title = el("h1", "pitch-h1", "Rows and columns are one type")
  title.id = "top"
  headings.push({ level: 1, text: "Rows and columns are one type", id: "top" })
  lede.append(title)
  const sub = el("p", "pitch-sub")
  sub.append(
    document.createTextNode("Both axes are an "),
    code("Axis<K, T>"),
    document.createTextNode(" ("),
    code("src/0_types.ts:40"),
    document.createTextNode("), derived through five pure operators into signals. "),
    code("state.orientation"),
    document.createTextNode(" decides which one scrolls, and no branch on orientation exists in "),
    code("src/"),
    document.createTextNode("."),
  )
  lede.append(sub)
  const proof = el("p", "pitch-grep")
  proof.append(code(GREP), el("span", "pitch-grep-out", "no output, exit 1"))
  lede.append(proof)
  page.append(lede)

  // 2. The claims.
  const claims = section("claims", "Four claims, four receipts")
  const list = el("ol", "pitch-claims")
  for (const item of CLAIMS) {
    const entry = el("li", "pitch-claim")
    entry.append(el("p", "pitch-claim-text", item.claim))
    entry.append(el("p", "pitch-claim-note", item.note))
    const where = el("p", "pitch-claim-where")
    for (const line of item.receipt) where.append(code(line))
    entry.append(where)
    list.append(entry)
  }
  claims.append(list)

  // 3. The live grid.
  const head2head = section("head-to-head", "Measured against @tanstack/table-core 9.1.0")
  const rows = benchRows()
  const caption = el("p", "pitch-caption")
  caption.append(
    document.createTextNode(
      "Six operations, four of them ours and two of them theirs. The two losses are in this table and not in a footnote: grouping 100k rows on one key, and a write to a state key the row pipeline never reads. Source ",
    ),
    code("bench/README.md:251"),
    document.createTextNode(", carried here by "),
    code("site/stats.json"),
    document.createTextNode("."),
  )
  head2head.append(caption)

  const upright = el("div", "pitch-grid")
  upright.tabIndex = 0
  head2head.append(upright)
  head2head.append(
    el(
      "p",
      "pitch-caption",
      "Live, through grid() and render() from src/. Click a header to sort, shift-click for a second key, drag a header edge to resize. orientation: rows, so six vertical entries and four across.",
    ),
  )

  const transposeNote = el("p", "pitch-caption")
  transposeNote.append(
    document.createTextNode("Writing "),
    code('orientation: "columns"'),
    document.createTextNode(
      " turns this into four vertical entries and six across. The swap is asserted on the model at ",
    ),
    code("src/12_transpose.test.ts:190"),
    document.createTextNode(". The renderer emits the frame and no cell values under it yet, measured in "),
    code("docs/6_why.md"),
    document.createTextNode(", section 6, which is why one grid is mounted here and not two."),
  )
  head2head.append(transposeNote)

  const stopUpright = mountBench(upright, rows)

  // 4. The counts.
  const counts = section("counts", "Counts")
  const tiles = el("div", "pitch-tiles")
  const tile = (value: string, label: string, source: string): HTMLElement => {
    const node = el("div", "pitch-tile")
    node.append(el("p", "pitch-tile-value", value), el("p", "pitch-tile-label", label), code(source))
    return node
  }
  const unit = STATS.tests.unit
  const library = STATS.bundle.library
  tiles.append(
    tile(
      unit.tests === null ? "not measured" : String(unit.tests),
      `unit tests, ${unit.failed ?? 0} failed`,
      unit.command,
    ),
    tile(String(STATS.source.sourceFiles), `source files, ${STATS.source.sourceLines} lines`, "stats.json source"),
    tile(String(STATS.source.testFiles), `test files, ${STATS.source.testLines} lines`, "stats.json source"),
    tile(
      library.totalGzipBytes === null ? "not measured" : formatBytes(library.totalGzipBytes),
      "the package, gzipped, JS and CSS",
      "stats.json bundle.library",
    ),
  )
  counts.append(tiles)
  counts.append(
    el(
      "p",
      "pitch-caption",
      `Measured on ${STATS.machine.cpuModel ?? STATS.machine.platform}, node ${STATS.machine.node}, at commit ${STATS.commit.short ?? "unknown"}.`,
    ),
  )

  // 5. Parity.
  const parity = section("parity", "Parity, and what it refuses to count")
  const numbers = parityCounts()
  if (numbers === null) {
    parity.append(el("p", "pitch-caption", "docs/1_parity.md did not parse. Read the Parity page."))
  } else {
    const parityTiles = el("div", "pitch-tiles")
    parityTiles.append(
      tile(String(numbers.tracked), "features tracked", "scripts/parity.mjs"),
      tile(String(numbers.implemented), "implemented, tag sits on code", "@feature"),
      tile(String(numbers.declared), "declared, nothing runs them", "@feature-declared"),
      tile(String(numbers.tanstack), "of the same list in TanStack v9", "table-core 9.1.0 dist"),
    )
    parity.append(parityTiles)
    const why = el("p", "pitch-caption")
    why.append(
      document.createTextNode(
        `The matrix reports ${numbers.implemented} rather than ${numbers.implemented + numbers.declared} because a `,
      ),
      code("@feature"),
      document.createTextNode(" tag sitting on a declaration with no function and no call inside it fails the run: "),
      code("scripts/parity.mjs:40"),
      document.createTextNode(" decides what carries code, "),
      code("scripts/parity.mjs:210"),
      document.createTextNode(" fails on the rest."),
    )
    parity.append(why)
  }

  // 6. Not built.
  const gaps = section("not-built", "Not built, by decision")
  const cut = cutFeatures()
  if (cut.length > 0) {
    const cutList = el("ul", "pitch-cut")
    for (const id of cut) {
      const item = document.createElement("li")
      item.append(code(id))
      cutList.append(item)
    }
    gaps.append(cutList)
  }
  const gapNote = el("p", "pitch-caption")
  gapNote.append(
    document.createTextNode("Each keeps a "),
    code("FeatureId"),
    document.createTextNode(" so the gap stays visible, and each carries a written reason at "),
    code("scripts/parity.mjs:90"),
    document.createTextNode(". Tagging one as implemented fails the run ("),
    code("scripts/parity.mjs:240"),
    document.createTextNode("). "),
    code("filterAxis"),
    document.createTextNode(" exists at "),
    code("src/1_axis.ts:225"),
    document.createTextNode(" and no stage of the view chain calls it. The design argument is "),
    code("docs/6_why.md"),
    document.createTextNode("."),
  )
  gaps.append(gapNote)

  return {
    headings,
    teardown: stopUpright,
  }
}
