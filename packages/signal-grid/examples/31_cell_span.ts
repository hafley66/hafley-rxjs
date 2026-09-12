// `ColumnDef.span` answers `{ rows, cols }` for a row reaching past its own seat, crossed by the
// kernel into `view.spans` and `view.covered`. The toggle flips a signal the span callback reads.
import { fromEvent, Subscription, tap } from "rxjs"
import { Signal } from "@hafley66/signals"
import { mountInView, runWhenInView } from "@hafley66/docs-kit"
import { grid, render, type ColumnDef } from "../src/index.js"
import source from "./31_cell_span.ts?raw"
import type { Example } from "./0_types.js"

interface Row {
  readonly id: string
  readonly name: string
  readonly kind: string
  readonly value: number
  readonly wide: boolean
  readonly note: string
}

const ROWS: readonly Row[] = Array.from({ length: 12 }, (_, i) => {
  const wide = i % 4 === 1
  return {
    id: `r${i}`,
    name: `item-${String(i).padStart(2, "0")}`,
    kind: wide ? "summary" : "detail",
    value: (i * 37) % 500,
    wide,
    note: wide ? "a note reaching two rows and two columns while spanning is on" : `note ${i}`,
  }
})

export const cellSpan: Example = {
  id: "cell-span",
  title: "Spanning cells",
  summary: "A note cell reaches over its neighbours; the toggle turns the span callback off and every cell stands alone.",
  feature: "cell.span",
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
    const spanning = Signal<boolean>(true)
    const columns: readonly ColumnDef<Row>[] = [
      { id: "name", header: "Name", flex: 1, minWidth: 160 },
      {
        id: "note",
        header: "Note",
        flex: 1,
        minWidth: 220,
        span: (row) => (spanning.$() && row.wide ? { rows: 2, cols: 2 } : undefined),
      },
      { id: "kind", header: "Kind", width: 110 },
      { id: "value", header: "Value", width: 100 },
    ]
    const g = grid<Row>({ id: "cell-span", rows: ROWS, columns, rowId: (row) => row.id })
    const handle = render(g, root)
    const subs = new Subscription()
    subs.add(runWhenInView(g.view.covered.$.pipe(tap((covered) => {
      toggle.textContent = spanning.$() ? "spanning: on" : "spanning: off"
      label.textContent = `${covered.size} cells covered`
    }))))
    const clicked$ = fromEvent(toggle, "click")
    subs.add(runWhenInView(clicked$.pipe(tap(() => spanning.$(!spanning.$())))))
    return () => {
      subs.unsubscribe()
      handle.stop()
      g.close()
      box.remove()
    }
  }),
}
