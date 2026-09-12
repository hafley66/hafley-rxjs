// `collapseToOneEntry` in `src/12_transpose.ts` keeps a single horizontal entry when `listView` is
// on, so the same rows render as a table or as a one-column list with no second code path.
import { fromEvent, Subscription, tap } from "rxjs"
import { mountInView, runWhenInView } from "@hafley66/docs-kit"
import { grid, render, type ColumnDef } from "../src/index.js"
import source from "./33_list_view.ts?raw"
import type { Example } from "./0_types.js"

interface Row {
  readonly id: string
  readonly name: string
  readonly kind: string
  readonly value: number
}

const ROWS: readonly Row[] = Array.from({ length: 16 }, (_, i) => ({
  id: `r${i}`,
  name: `contact-${String(i).padStart(2, "0")}`,
  kind: i % 3 === 0 ? "lead" : "customer",
  value: (i * 71) % 900,
}))

const COLUMNS: readonly ColumnDef<Row>[] = [
  { id: "name", header: "Name", flex: 1, minWidth: 160 },
  { id: "kind", header: "Kind", width: 110 },
  { id: "value", header: "Value", width: 100 },
]

export const listView: Example = {
  id: "list-view",
  title: "List view",
  summary: "A button writes state.listView and the same rows collapse to one column, then expand back.",
  feature: "view.list",
  source,
  mount: (host) => mountInView(host, () => {
    const box = document.createElement("div")
    const toggle = document.createElement("button")
    toggle.type = "button"
    const label = document.createElement("code")
    const root = document.createElement("div")
    root.style.blockSize = "320px"
    box.append(toggle, label, root)
    host.append(box)
    const g = grid<Row>({ id: "list-view", rows: ROWS, columns: COLUMNS, rowId: (row) => row.id })
    const handle = render(g, root)
    const subs = new Subscription()
    subs.add(runWhenInView(g.view.cols.$.pipe(tap((cols) => {
      const on = g.state.listView.$()
      toggle.textContent = on ? "list view: on" : "list view: off"
      label.textContent = `${cols.length} column${cols.length === 1 ? "" : "s"} shown`
    }))))
    const clicked$ = fromEvent(toggle, "click")
    subs.add(runWhenInView(clicked$.pipe(tap(() => g.state.listView.$(!g.state.listView.$())))))
    return () => {
      subs.unsubscribe()
      handle.stop()
      g.close()
      box.remove()
    }
  }),
}
