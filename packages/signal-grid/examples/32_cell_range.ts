// `selectCellsOnDrag` and `keyboardNav` are in `defaultEpics()` already, so a plain grid drags a
// range into `state.selection` and steps `state.focus` on arrow keys with no epic wired here.
import { merge, Subscription, tap } from "rxjs"
import { mountInView, runWhenInView } from "@hafley66/docs-kit"
import { grid, liveBlock, rangeOf, rectOf, render, type ColumnDef, type Grid } from "../src/index.js"
import source from "./32_cell_range.ts?raw"
import type { Example } from "./0_types.js"

interface Row {
  readonly id: string
  readonly name: string
  readonly kind: string
  readonly value: number
}

const ROWS: readonly Row[] = Array.from({ length: 14 }, (_, i) => ({
  id: `r${i}`,
  name: `entry-${String(i).padStart(2, "0")}`,
  kind: i % 2 === 0 ? "even" : "odd",
  value: (i * 53) % 400,
}))

const COLUMNS: readonly ColumnDef<Row>[] = [
  { id: "name", header: "Name", flex: 1, minWidth: 160 },
  { id: "kind", header: "Kind", width: 110 },
  { id: "value", header: "Value", width: 100 },
]

/** Reads the block, if any, plus focus, and renders them as one text line. */
function describe(g: Grid<Row>): string {
  const focusText = g.state.focus.$() ?? "none"
  const block = liveBlock(rangeOf(g.state.selection.$()))
  if (block === null) return `no range, focus ${focusText}`
  const vertical = g.view.vertical.$().nodes.map((it) => it.key)
  const horizontal = g.view.colLeaves.$()
  const rect = rectOf(block, vertical, horizontal)
  if (rect.vertical.length === 0 || rect.horizontal.length === 0) return `no range, focus ${focusText}`
  const rows = `${rect.vertical[0]}..${rect.vertical[rect.vertical.length - 1]}`
  const cols = `${rect.horizontal[0]}..${rect.horizontal[rect.horizontal.length - 1]}`
  return `${rect.vertical.length}x${rect.horizontal.length}, rows ${rows}, cols ${cols}, focus ${focusText}`
}

export const cellRange: Example = {
  id: "cell-range",
  title: "Range selection and focus",
  summary: "Drag a block of cells or press arrow keys; the readout names the rectangle and the focused key.",
  feature: "cell.focus",
  source,
  mount: (host) => mountInView(host, () => {
    const box = document.createElement("div")
    const label = document.createElement("code")
    const root = document.createElement("div")
    root.style.blockSize = "320px"
    box.append(label, root)
    host.append(box)
    const g = grid<Row>({ id: "cell-range", rows: ROWS, columns: COLUMNS, rowId: (row) => row.id })
    const handle = render(g, root)
    const subs = new Subscription()
    subs.add(runWhenInView(merge(g.state.selection.$, g.state.focus.$).pipe(tap(() => {
      label.textContent = describe(g)
    }))))
    return () => {
      subs.unsubscribe()
      handle.stop()
      g.close()
      box.remove()
    }
  }),
}
