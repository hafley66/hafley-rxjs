// Reads the three wide tables of the rendered `docs/1_parity.md` back out of the DOM, hides them,
// and mounts one live grid under the "The matrix" heading. Sorting is the epic `bind()` installs.
import { Signal } from "@hafley66/signals"
import { tap } from "rxjs"
import {
  grid,
  mountInView,
  render,
  runWhenInView,
  type CellCtx,
  type ColumnDef,
  type GridState,
  type Renderable,
  type Viewport,
} from "../src/index.js"
import muiRaw from "../docs/parity.mui.json?raw"
import tanstackRaw from "../docs/parity.tanstack.json?raw"

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

/** Heading text without the anchor link the theme appends to every heading. */
function headingText(heading: Element): string {
  const copy = heading.cloneNode(true) as Element
  for (const anchor of copy.querySelectorAll(".header-anchor")) anchor.remove()
  return (copy.textContent ?? "").trim()
}

const norm = (text: string): string => text.trim().toLowerCase()

const cellsOf = (row: Element): Element[] => [...row.querySelectorAll("th, td")]

/** Reads a table under a known header set by column name, so a regenerated order still lands. */
function columnIndex(header: readonly Element[]): Record<string, number> {
  const index: Record<string, number> = {}
  header.forEach((cell, position) => {
    index[norm(cell.textContent ?? "")] = position
  })
  return index
}

const at = (row: readonly Element[], position: number | undefined): Element | undefined =>
  position === undefined ? undefined : row[position]

const textOf = (cell: Element | undefined): string => (cell?.textContent ?? "").replace(/\s+/g, " ").trim()

/** `<code>row.sort</code><br>Order rows by one column` splits into the id and the sentence after it. */
function featureCell(cell: Element | undefined): { id: string; label: string } {
  if (cell === undefined) return { id: "", label: "" }
  const code = cell.querySelector("code")
  const id = (code?.textContent ?? textOf(cell)).trim()
  const copy = cell.cloneNode(true) as Element
  copy.querySelector("code")?.remove()
  return { id, label: textOf(copy) }
}

const statusText = (cell: Element | undefined): string => textOf(cell?.querySelector("a") ?? cell)

const urlOf = (cell: Element | undefined): string => cell?.querySelector("a")?.getAttribute("href") ?? ""

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

interface Parsed {
  readonly rows: ParityRow[]
  /** The tables and the axis headings that only label them, which leave the page once the grid is up. */
  readonly replaced: HTMLElement[]
  readonly anchor: HTMLElement | null
}

export function parseParity(doc: HTMLElement): Parsed {
  const rows: ParityRow[] = []
  const replaced: HTMLElement[] = []
  let anchor: HTMLElement | null = null
  let section = ""
  let axis = ""
  for (const node of doc.querySelectorAll("h2, h3, table")) {
    if (!(node instanceof HTMLElement)) continue
    if (node.tagName === "H2") {
      section = headingText(node)
      axis = ""
      if (section === "The matrix") anchor = node
      continue
    }
    const inTables = SECTIONS.includes(section)
    if (node.tagName === "H3") {
      axis = headingText(node)
      if (inTables) replaced.push(node)
      continue
    }
    if (!inTables) continue
    const headerRow = node.querySelector("thead tr")
    if (headerRow === null) continue
    const index = columnIndex(cellsOf(headerRow))
    if (index["feature"] === undefined) continue
    replaced.push(node)
    const group = section === "The matrix" ? (axis === "" ? "Matrix" : axis) : section
    for (const line of node.querySelectorAll("tbody tr")) {
      const cellRow = cellsOf(line)
      const { id, label } = featureCell(at(cellRow, index["feature"]))
      if (id === "") continue
      const muiCell = at(cellRow, index["mui x"])
      rows.push({
        key: `${group}|${id}`,
        id,
        section: group,
        feature: label,
        why: textOf(at(cellRow, index["why it matters"])) || textOf(at(cellRow, index["reason"])),
        tanstack: statusText(at(cellRow, index["tanstack v9"])) || (TANSTACK[id]?.status ?? ""),
        mui: statusText(muiCell) || (MUI[id]?.status ?? ""),
        grid:
          section === "The matrix"
            ? statusText(at(cellRow, index["signal-grid"]))
            : section === "Cut on purpose"
              ? "cut on purpose"
              : "not decided",
        where: textOf(at(cellRow, index["where"])),
        muiUrl: MUI[id]?.url ?? urlOf(muiCell),
        detail: detailOf(id),
      })
    }
  }
  return { rows, replaced, anchor }
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

// One schema-wide slot dispatching on the column: `src/10_render.ts:198` reads `g.slots.cell` and
// never looks at the column's own slot, so a `cell` written on a `ColumnDef` renders as plain text.
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
 * Replaces the three wide tables inside a rendered parity document with one live grid. Returns null
 * when no table parsed, which leaves the document exactly as VitePress rendered it.
 */
export function mountParity(doc: HTMLElement): ParityMount | null {
  const { rows: all, replaced, anchor } = parseParity(doc)
  if (all.length === 0 || anchor === null) return null

  for (const node of replaced) node.hidden = true
  const mountHost = el("div", "parity")
  anchor.insertAdjacentElement("afterend", mountHost)

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
    state: Signal<Partial<GridState>>({ virtualize: { vertical: true, horizontal: false } }),
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

  const counted$ = rows.$.pipe(
    tap((visible) => {
      count.textContent = `${visible.length} of ${all.length} features. Click a header to sort, shift-click to add a second key.`
    }),
  )

  const stopCount = mountInView(gridHost, () => runWhenInView(counted$))

  return {
    teardown: () => {
      stopCount()
      observer.disconnect()
      if (scroll instanceof HTMLElement) scroll.removeEventListener("scroll", onScroll)
      gridHost.removeEventListener("keydown", onKey)
      unbind()
      handle.stop()
      mountHost.remove()
      for (const node of replaced) node.hidden = false
    },
  }
}
