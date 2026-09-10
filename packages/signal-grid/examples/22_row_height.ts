// A row with no entry in `rowHeight` is the uniform case, which is O(1) per lookup and the reason
// variable height is opt-in. An entry switches that row's sizer to the measured path, and the height
// reaches the layout as a custom property named after the row, aliased so one CSS rule serves all.
import { grid, render, type CellCtx, type ColumnDef, type Renderable, type Slot } from "../src/index.js"
import source from "./22_row_height.ts?raw"
import type { Example } from "./0_types.js"

interface Row {
  readonly id: string
  readonly name: string
  readonly note: string
}

const NOTES = [
  "One line.",
  "Two lines of note text that wrap inside the cell rather than being clipped to a single line.",
  "Three lines of note text, long enough that the row it sits in has to be told to make room for it before any of it can be read.",
]

const ROWS: readonly Row[] = Array.from({ length: 16 }, (_, i) => ({
  id: `r${i}`,
  name: `remark-${String(i).padStart(2, "0")}`,
  note: NOTES[i % 3] ?? "One line.",
}))

const TALL: Readonly<Record<string, number>> = { r1: 76, r2: 108, r4: 76, r5: 108 }

const wrapped: Slot<CellCtx<Row>> = (ctx): Renderable => {
  const text = document.createElement("div")
  text.textContent = String(ctx.value)
  text.style.cssText = "white-space:normal;line-height:1.35;inline-size:100%"
  return text
}

const COLUMNS: readonly ColumnDef<Row>[] = [
  { id: "name", header: "Name", width: 160 },
  { id: "note", header: "Note", flex: 1, minWidth: 240, cell: wrapped },
]

export const rowHeight: Example = {
  id: "row-height",
  title: "Per-row height",
  summary: "Four rows carry their own height; the rest fall through to the density default.",
  feature: "row.height",
  source,
  mount: (host) => {
    const root = document.createElement("div")
    root.style.blockSize = "320px"
    host.append(root)
    const g = grid<Row>({
      id: "row-height",
      rows: ROWS,
      columns: COLUMNS,
      rowId: (row) => row.id,
      state: { rowHeight: TALL },
    })
    const handle = render(g, root)
    return () => {
      handle.stop()
      root.remove()
    }
  },
}
