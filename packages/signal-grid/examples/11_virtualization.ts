// Fifty thousand rows in the model, a couple of dozen in the document. The toggle writes one state
// key and the kernel is identical either way, which is the claim worth being able to break: turning
// it off puts all fifty thousand row elements in the page, and the readout shows the cost.
import { fromEvent, Subscription } from "rxjs"
import { grid, render, type ColumnDef } from "../src/index.js"
import source from "./11_virtualization.ts?raw"
import type { Example } from "./0_types.js"

interface Row {
  readonly id: string
  readonly name: string
  readonly value: number
}

const ROWS: readonly Row[] = Array.from({ length: 50_000 }, (_, i) => ({
  id: `r${i}`,
  name: `row-${String(i).padStart(5, "0")}`,
  value: (i * 2654435761) % 100_000,
}))

const COLUMNS: readonly ColumnDef<Row>[] = [
  { id: "name", header: "Name", flex: 1, minWidth: 200 },
  { id: "value", header: "Value", width: 140 },
]

export const virtualization: Example = {
  id: "virtualization-50k",
  title: "Virtualization on and off, 50k rows",
  summary: "Fifty thousand rows recycle through a bounded document; the toggle renders all of them instead.",
  feature: "view.virtualize.row",
  source,
  mount: (host) => {
    const box = document.createElement("div")
    const toggle = document.createElement("button")
    toggle.type = "button"
    const label = document.createElement("code")
    const root = document.createElement("div")
    root.style.blockSize = "340px"
    box.append(toggle, label, root)
    host.append(box)
    const g = grid<Row>({
      id: "virtualization-50k",
      rows: ROWS,
      columns: COLUMNS,
      rowId: (row) => row.id,
      overscan: 6,
    })
    const handle = render(g, root)
    const subs = new Subscription()
    subs.add(g.view.plan.$.subscribe((plan) => {
      const on = g.state.virtualize.vertical.$()
      toggle.textContent = on ? "virtualize: on" : "virtualize: off"
      label.textContent = `${ROWS.length} rows in the model, ${plan.center.length} rendered`
    }))
    subs.add(
      fromEvent(toggle, "click").subscribe(() =>
        g.state.virtualize.vertical.$(!g.state.virtualize.vertical.$()),
      ),
    )
    return () => {
      subs.unsubscribe()
      handle.stop()
      box.remove()
    }
  },
}
