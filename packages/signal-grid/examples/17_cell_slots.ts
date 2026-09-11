// `Slots.cell` is the schema-wide default; a `cell` on a `ColumnDef` beats it for that column only.
// A slot hands back DOM, so no template language is involved and nothing is diffed: the cell is
// built once and rebuilt only when its row's data, column run, or editing flag moved.
import { grid, render, type CellCtx, type ColumnDef, type Renderable, type Slot } from "../src/index.js"
import source from "./17_cell_slots.ts?raw"
import type { Example } from "./0_types.js"

interface Row {
  readonly id: string
  readonly name: string
  readonly share: number
  readonly state: string
}

const STATES = ["passing", "flaky", "failing"] as const

const ROWS: readonly Row[] = Array.from({ length: 22 }, (_, i) => ({
  id: `r${i}`,
  name: `suite-${String(i).padStart(2, "0")}`,
  share: (i * 13) % 101,
  state: STATES[i % 3] ?? "passing",
}))

const bar: Slot<CellCtx<Row>> = (ctx): Renderable => {
  const track = document.createElement("div")
  track.style.cssText = "inline-size:100%;block-size:10px;background:var(--sg-line);border-radius:5px"
  const fill = document.createElement("div")
  fill.style.cssText = `inline-size:${Number(ctx.value)}%;block-size:100%;background:var(--sg-focus);border-radius:5px`
  track.append(fill)
  return track
}

const badge: Slot<CellCtx<Row>> = (ctx): Renderable => {
  const chip = document.createElement("span")
  chip.textContent = String(ctx.value)
  chip.style.cssText = "padding:1px 8px;border-radius:9px;border:1px solid var(--sg-line);font-size:0.85em"
  return chip
}

const COLUMNS: readonly ColumnDef<Row>[] = [
  { id: "name", header: "Suite", flex: 1, minWidth: 160 },
  { id: "share", header: "Coverage", width: 180, cell: bar },
  { id: "state", header: "State", width: 130, cell: badge },
]

export const cellSlots: Example = {
  id: "cell-slots",
  title: "Custom cell slots",
  summary: "Two columns render DOM of their own; the third keeps the built-in text cell.",
  feature: "view.slots",
  source,
  mount: (host) => {
    const root = document.createElement("div")
    root.style.blockSize = "300px"
    host.append(root)
    const g = grid<Row>({ id: "cell-slots", rows: ROWS, columns: COLUMNS, rowId: (row) => row.id })
    const handle = render(g, root)
    return () => {
      handle.stop()
      g.close()
      root.remove()
    }
  },
}
