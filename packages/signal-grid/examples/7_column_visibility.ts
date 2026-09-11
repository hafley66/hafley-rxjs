// Hiding is a model operation, not a `display: none`: the cells leave the document and the
// remaining flex columns take the freed width, so a hidden column costs nothing to render.
import { fromEvent, Subscription } from "rxjs"
import { grid, mountInView, render, runWhenInView, type ColumnDef } from "../src/index.js"
import source from "./7_column_visibility.ts?raw"
import type { Example } from "./0_types.js"

interface Row {
  readonly id: string
  readonly name: string
  readonly size: number
  readonly kind: string
  readonly owner: string
}

const ROWS: readonly Row[] = Array.from({ length: 20 }, (_, i) => ({
  id: `r${i}`,
  name: `item-${String(i).padStart(2, "0")}`,
  size: (i * 211) % 800,
  kind: i % 2 === 0 ? "draft" : "final",
  owner: i % 3 === 0 ? "ana" : "bo",
}))

const COLUMNS: readonly ColumnDef<Row>[] = [
  { id: "name", header: "Name", flex: 2, minWidth: 120 },
  { id: "size", header: "Size", flex: 1, minWidth: 80 },
  { id: "kind", header: "Kind", flex: 1, minWidth: 80 },
  { id: "owner", header: "Owner", flex: 1, minWidth: 80 },
]

export const columnVisibility: Example = {
  id: "column-visibility",
  title: "Column visibility",
  summary: "Toggle a column out of the schema; unhiding returns it to its rank, never to the end.",
  feature: "col.visible",
  source,
  mount: (host) => mountInView(host, () => {
    const box = document.createElement("div")
    const bar = document.createElement("div")
    const root = document.createElement("div")
    root.style.blockSize = "280px"
    box.append(bar, root)
    host.append(box)
    const g = grid<Row>({ id: "column-visibility", rows: ROWS, columns: COLUMNS, rowId: (row) => row.id })
    const handle = render(g, root)
    const subs = new Subscription()
    for (const col of COLUMNS) {
      const button = document.createElement("button")
      button.type = "button"
      button.textContent = col.header ?? col.id
      bar.append(button)
      subs.add(
        runWhenInView(fromEvent(button, "click"), () => {
          const hidden = g.state.colHidden.$()
          g.state.colHidden.$({ ...hidden, [col.id]: hidden[col.id] !== true })
        }),
      )
    }
    return () => {
      subs.unsubscribe()
      handle.stop()
      g.close()
      box.remove()
    }
  }),
}
