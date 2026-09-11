// `resizable: true` is what makes the renderer append the handle inside the header cell, and
// `resizeOnHeaderDrag` is already installed by `defaultEpics()`, so the drag needs no extra wiring.
// The width that lands in state is the resolved one, so a flex column freezes where it actually sat.
import { Subscription, tap } from "rxjs"
import { mountInView, runWhenInView } from "@hafley66/docs-kit"
import { grid, render, type ColumnDef } from "../src/index.js"
import source from "./8_column_resize.ts?raw"
import type { Example } from "./0_types.js"

interface Row {
  readonly id: string
  readonly name: string
  readonly size: number
  readonly kind: string
  readonly owner: string
}

const ROWS: readonly Row[] = Array.from({ length: 24 }, (_, i) => ({
  id: `r${i}`,
  name: `measurement-${String(i).padStart(2, "0")}`,
  size: (i * 457) % 5000,
  kind: i % 2 === 0 ? "sampled" : "derived",
  owner: i % 3 === 0 ? "ana" : "bo",
}))

const COLUMNS: readonly ColumnDef<Row>[] = [
  { id: "name", header: "Name", width: 220, minWidth: 80, maxWidth: 480, resizable: true },
  { id: "size", header: "Size", width: 120, minWidth: 60, maxWidth: 400, resizable: true },
  { id: "kind", header: "Kind", width: 140, minWidth: 60, maxWidth: 400, resizable: true },
  { id: "owner", header: "Owner", width: 160, minWidth: 60, maxWidth: 400, resizable: true },
]

export const columnResize: Example = {
  id: "column-resize",
  title: "Column resize by drag",
  summary: "Drag the right edge of a header; one write moves the header band, the row band, and the model.",
  feature: "col.resize",
  source,
  mount: (host) => mountInView(host, () => {
    const box = document.createElement("div")
    const readout = document.createElement("code")
    const root = document.createElement("div")
    root.style.blockSize = "300px"
    box.append(readout, root)
    host.append(box)
    const g = grid<Row>({ id: "column-resize", rows: ROWS, columns: COLUMNS, rowId: (row) => row.id })
    const handle = render(g, root)
    const subs = new Subscription()
    subs.add(runWhenInView(g.view.widths.$.pipe(tap((widths) => {
      readout.textContent = [...widths].map(([id, px]) => `${id} ${Math.round(px)}`).join("  ")
    }))))
    return () => {
      subs.unsubscribe()
      handle.stop()
      g.close()
      box.remove()
    }
  }),
}
