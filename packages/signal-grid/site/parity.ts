// The parity page, rendered by the grid this site documents.
//
// `docs/1_parity.md` is generated and eleven columns wide, which reads on a page as a horizontal
// scrollbar over text nobody can filter. The tables are parsed back into rows, joined with the two
// citation files the generator itself reads, and handed to `grid()` plus `render()` from `../src`.
// Sorting is the `sortOnHeaderClick` epic that `bind()` installs, not code written here.
//
// The prose around the tables still renders as markdown. Only the three wide tables are replaced.
import { Signal } from "@hafley66/signals"
import {
  grid,
  render,
  type CellCtx,
  type ColumnDef,
  type GridState,
  type Renderable,
  type Viewport,
} from "../src/index.js"
import muiRaw from "../docs/parity.mui.json?raw"
import tanstackRaw from "../docs/parity.tanstack.json?raw"
import { parseBlocks, plain, renderBlocks, type Block, type Heading } from "./md.js"

interface Citation {
  readonly status?: string
  readonly tier?: string | null
  readonly api?: string | null
  readonly url?: string | null
  readonly note?: string | null
}

const MUI = JSON.parse(muiRaw) as Record<string, Citation | undefined>
const TANSTACK = JSON.parse(tanstackRaw) as Record<string, Citation | undefined>

export interface ParityRow {
  /** Section plus id: four feature ids appear in two sections and a row key has to be unique. */
  readonly key: string
  readonly id: string
  readonly section: string
  readonly feature: string
  readonly why: string
  readonly tanstack: string
  readonly mui: string
  readonly grid: string
  readonly where: string
  readonly muiUrl: string
  readonly detail: string
}

const SECTIONS = ["The matrix", "Cut on purpose", "Not decided yet"]

const norm = (text: string): string => plain(text).trim().toLowerCase()

/** Reads a table under a known header set by column name, so a regenerated order still lands. */
function columnIndex(header: readonly string[]): Record<string, number> {
  const index: Record<string, number> = {}
  header.forEach((cell, position) => {
    index[norm(cell)] = position
  })
  return index
}

const at = (row: readonly string[], position: number | undefined): string =>
  position === undefined ? "" : (row[position] ?? "")

/** `` `row.sort`<br>Order rows by one column `` splits into the id and the sentence after it. */
function featureCell(cell: string): { id: string; label: string } {
  const code = /`([^`]+)`/.exec(cell)
  const id = code?.[1] ?? plain(cell).trim()
  const rest = cell.replace(/`[^`]+`/, "").replace(/<br\s*\/?>/gi, " ").trim()
  return { id, label: plain(rest) }
}

const statusText = (cell: string): string => {
  const link = /\[([^\]]+)\]/.exec(cell)
  return plain(link?.[1] ?? cell).trim()
}

const urlOf = (cell: string): string => /\]\(([^)]+)\)/.exec(cell)?.[1] ?? ""

function detailOf(id: string): string {
  const mui = MUI[id]
  const tan = TANSTACK[id]
  const lines: string[] = []
  if (tan?.api) lines.push(`TanStack: ${tan.api}`)
  if (tan?.note) lines.push(tan.note)
  if (mui?.api) lines.push(`MUI: ${mui.api}`)
  if (mui?.note) lines.push(mui.note)
  return lines.join("\n")
}

export function parseParity(source: string): ParityRow[] {
  const rows: ParityRow[] = []
  let section = ""
  let axis = ""
  for (const block of parseBlocks(source)) {
    if (block.kind === "heading" && block.level === 2) {
      section = plain(block.text).trim()
      axis = ""
      continue
    }
    if (block.kind === "heading" && block.level === 3) {
      axis = plain(block.text).trim()
      continue
    }
    if (block.kind !== "table" || !SECTIONS.includes(section)) continue
    const index = columnIndex(block.header)
    if (index["feature"] === undefined) continue
    const group = section === "The matrix" ? (axis === "" ? "Matrix" : axis) : section
    for (const cellRow of block.rows) {
      const { id, label } = featureCell(at(cellRow, index["feature"]))
      if (id === "") continue
      const muiCell = at(cellRow, index["mui x"])
      const reason = at(cellRow, index["reason"])
      rows.push({
        key: `${group}|${id}`,
        id,
        section: group,
        feature: label,
        why: plain(at(cellRow, index["why it matters"])) || plain(reason),
        tanstack: statusText(at(cellRow, index["tanstack v9"])) || (TANSTACK[id]?.status ?? ""),
        mui: statusText(muiCell) || (MUI[id]?.status ?? ""),
        grid:
          section === "The matrix"
            ? statusText(at(cellRow, index["signal-grid"]))
            : section === "Cut on purpose"
              ? "cut on purpose"
              : "not decided",
        where: plain(at(cellRow, index["where"]).replace(/<br\s*\/?>/gi, " ")),
        muiUrl: MUI[id]?.url ?? urlOf(muiCell),
        detail: detailOf(id),
      })
    }
  }
  return rows
}

// --- Cells ------------------------------------------------------------------

const el = (tag: string, className: string, text?: string): HTMLElement => {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

const toneOf = (status: string): string =>
  status.startsWith("yes") ? "yes" : status.startsWith("partial") ? "partial" : status.startsWith("declared") ? "declared" : "no"

function statusPill(status: string): HTMLElement {
  const pill = el("span", "pill", status)
  pill.dataset.tone = toneOf(status)
  return pill
}

const COLUMNS: readonly ColumnDef<ParityRow>[] = [
  { id: "id", header: "Feature", type: "string", width: 190, resizable: true },
  { id: "feature", header: "What it does", type: "string", width: 300, resizable: true },
  { id: "section", header: "Axis", type: "string", width: 150, resizable: true },
  { id: "tanstack", header: "TanStack v9", type: "string", width: 120, resizable: true },
  { id: "mui", header: "MUI X", type: "string", width: 140, resizable: true },
  { id: "grid", header: "signal-grid", type: "string", width: 150, resizable: true },
  { id: "why", header: "Why it matters", type: "string", width: 420, resizable: true },
  { id: "where", header: "Where", type: "string", width: 240, resizable: true },
]

// One schema-wide slot dispatching on the column, rather than the per-column `ColumnDef.cell`
// field: `src/10_render.ts:198` reads `g.slots.cell` and never looks at the column's own slot, so
// a `cell` written on a `ColumnDef` renders as plain text. Reported to the kernel lane.
function cellSlot(ctx: CellCtx<ParityRow>): Renderable {
  const text = String(ctx.value ?? "")
  if (ctx.col === "id" || ctx.col === "where") {
    return text === "" ? "" : el("code", ctx.col === "id" ? "parity-id" : "parity-where", text)
  }
  if (ctx.col === "tanstack" || ctx.col === "grid") {
    return text === "" ? "" : statusPill(text)
  }
  if (ctx.col === "mui") {
    if (text === "") return ""
    const url = ctx.data.muiUrl
    if (url === "") return statusPill(text)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.target = "_blank"
    anchor.rel = "noreferrer noopener"
    anchor.className = "parity-cite"
    anchor.title = url
    anchor.append(statusPill(text))
    return anchor
  }
  const span = el("span", "parity-text", text)
  if (ctx.col === "feature" || ctx.col === "why") {
    span.title = ctx.data.detail === "" ? text : `${text}\n\n${ctx.data.detail}`
  }
  return span
}

// --- The page ---------------------------------------------------------------

export interface ParityMount {
  readonly headings: readonly Heading[]
  readonly teardown: () => void
}

const SUPPORTS = [
  { value: "any", label: "anyone" },
  { value: "tanstack", label: "TanStack v9" },
  { value: "mui", label: "MUI X" },
  { value: "grid", label: "signal-grid" },
]

function select(label: string, options: readonly string[], onPick: (value: string) => void): HTMLElement {
  const wrap = el("label", "filter")
  wrap.append(el("span", "filter-label", label))
  const field = document.createElement("select")
  for (const option of options) {
    const item = document.createElement("option")
    item.value = option
    item.textContent = option
    field.append(item)
  }
  field.addEventListener("change", () => onPick(field.value))
  wrap.append(field)
  return wrap
}

/**
 * Renders the whole parity document, with the three wide tables replaced by one live grid.
 * Returns null when the tables parse to nothing, which is the caller's cue to render the markdown
 * as written rather than to show an empty page.
 */
export function renderParityPage(source: string, host: HTMLElement): ParityMount | null {
  const all = parseParity(source)
  if (all.length === 0) return null

  const blocks = parseBlocks(source)
  const seen = new Map<string, number>()
  const headings: Heading[] = []
  const mountHost = el("div", "parity")

  let section = ""
  let pending: Block[] = []
  const flush = (): void => {
    if (pending.length === 0) return
    const rendered = renderBlocks(pending, seen)
    host.append(rendered.node)
    for (const heading of rendered.headings) headings.push(heading)
    pending = []
  }
  for (const block of blocks) {
    if (block.kind === "heading" && block.level === 2) {
      const next = plain(block.text).trim()
      pending.push(block)
      if (next === "The matrix") {
        flush()
        host.append(mountHost)
      }
      section = next
      continue
    }
    const inTables = SECTIONS.includes(section)
    // The three generated tables and the axis headings that only label them leave the prose.
    if (inTables && (block.kind === "table" || (block.kind === "heading" && block.level === 3))) continue
    pending.push(block)
  }
  flush()

  // --- filters --------------------------------------------------------------

  const axisFilter = Signal("all")
  const statusFilter = Signal("all")
  const supportFilter = Signal("any")
  const textFilter = Signal("")

  const axes = ["all", ...new Set(all.map((row) => row.section))]
  const statuses = ["all", ...new Set(all.map((row) => row.grid).filter((value) => value !== ""))]

  const supports = (row: ParityRow, who: string): boolean => {
    if (who === "tanstack") return row.tanstack.startsWith("yes")
    if (who === "mui") return row.mui.startsWith("yes")
    if (who === "grid") return row.grid.startsWith("yes")
    return true
  }

  const rows = Signal<readonly ParityRow[]>(() => {
    const axis = axisFilter.$()
    const status = statusFilter.$()
    const who = supportFilter.$()
    const text = textFilter.$().trim().toLowerCase()
    return all.filter((row) => {
      if (axis !== "all" && row.section !== axis) return false
      if (status !== "all" && row.grid !== status) return false
      if (!supports(row, who)) return false
      if (text === "") return true
      return `${row.id} ${row.feature} ${row.why} ${row.where} ${row.detail}`.toLowerCase().includes(text)
    })
  })

  const bar = el("div", "parity-bar")
  bar.append(
    select("Axis", axes, (value) => axisFilter.$(value)),
    select("signal-grid", statuses, (value) => statusFilter.$(value)),
  )
  const supportWrap = el("label", "filter")
  supportWrap.append(el("span", "filter-label", "Supported by"))
  const supportField = document.createElement("select")
  for (const option of SUPPORTS) {
    const item = document.createElement("option")
    item.value = option.value
    item.textContent = option.label
    supportField.append(item)
  }
  supportField.addEventListener("change", () => supportFilter.$(supportField.value))
  supportWrap.append(supportField)
  bar.append(supportWrap)

  const textWrap = el("label", "filter filter-text")
  textWrap.append(el("span", "filter-label", "Find"))
  const textField = document.createElement("input")
  textField.type = "search"
  textField.placeholder = "feature, api, note"
  textField.addEventListener("input", () => textFilter.$(textField.value))
  textWrap.append(textField)
  bar.append(textWrap)

  const count = el("p", "parity-count")
  const gridHost = el("div", "parity-grid")
  gridHost.tabIndex = 0
  mountHost.append(bar, count, gridHost)

  // --- the grid -------------------------------------------------------------

  const box = gridHost.getBoundingClientRect()
  const viewport = Signal<Viewport>({
    top: 0,
    left: 0,
    width: Math.round(box.width),
    height: Math.round(box.height),
  })

  const g = grid<ParityRow>({
    id: "parity",
    rows,
    columns: COLUMNS,
    rowId: (row) => row.key,
    state: Signal<Partial<GridState>>({ virtualize: true }),
    viewport,
    overscan: 6,
    slots: { cell: cellSlot },
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
  // The arrow keys belong to `keyboardNav`, so the scroll box does not also get them.
  const onKey = (event: KeyboardEvent): void => {
    if (event.key.startsWith("Arrow")) event.preventDefault()
  }
  gridHost.addEventListener("keydown", onKey)

  const countSub = rows.$.subscribe((visible) => {
    count.textContent = `${visible.length} of ${all.length} features. Click a header to sort, shift-click to add a second key.`
  })

  return {
    headings,
    teardown: () => {
      countSub.unsubscribe()
      observer.disconnect()
      if (scroll instanceof HTMLElement) scroll.removeEventListener("scroll", onScroll)
      gridHost.removeEventListener("keydown", onKey)
      unbind()
      handle.stop()
    },
  }
}
