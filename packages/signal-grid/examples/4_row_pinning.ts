// Pinning lifts rows out of the scrolling run before paging and virtualization narrow it, which is
// why a pinned row stays visible whatever page the rest of the relation is showing.
import { fromEvent, Subscription, tap } from "rxjs"
import { mountInView, runWhenInView } from "@hafley66/docs-kit"
import { grid, render, type ColumnDef, type Side } from "../src/index.js"
import source from "./4_row_pinning.ts?raw"
import type { Example } from "./0_types.js"

interface Row {
  readonly id: string
  readonly name: string
  readonly score: number
}

const ROWS: readonly Row[] = Array.from({ length: 200 }, (_, i) => ({
  id: `r${i}`,
  name: `entrant-${String(i).padStart(3, "0")}`,
  score: (i * 331) % 1000,
}))

const COLUMNS: readonly ColumnDef<Row>[] = [
  { id: "name", header: "Name", flex: 1, minWidth: 180 },
  { id: "score", header: "Score", width: 110 },
]

const PINNED: Readonly<Record<string, Side>> = { r0: "start", r1: "start", r199: "end" }

export const rowPinning: Example = {
  id: "row-pinning",
  title: "Row pinning",
  summary: "Two rows held at the top and one at the bottom while two hundred scroll between them.",
  feature: "row.pin",
  source,
  mount: (host) => mountInView(host, () => {
    const box = document.createElement("div")
    const bar = document.createElement("button")
    bar.type = "button"
    bar.textContent = "toggle pins"
    const root = document.createElement("div")
    root.style.blockSize = "300px"
    box.append(bar, root)
    host.append(box)
    const g = grid<Row>({
      id: "row-pinning",
      rows: ROWS,
      columns: COLUMNS,
      rowId: (row) => row.id,
      state: { rowPinning: PINNED },
    })
    const handle = render(g, root)
    const subs = new Subscription()
    const clicked$ = fromEvent(bar, "click")
    subs.add(
      runWhenInView(clicked$.pipe(tap(() => {
        const on = Object.keys(g.state.rowPinning.$()).length > 0
        g.state.rowPinning.$(on ? {} : PINNED)
      }))),
    )
    return () => {
      subs.unsubscribe()
      handle.stop()
      g.close()
      box.remove()
    }
  }),
}
