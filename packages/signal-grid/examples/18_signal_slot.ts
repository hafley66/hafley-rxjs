// A slot may hand back a signal instead of a node. The renderer subscribes that one node into the
// row's subscription and writes its text, so a value change repaints one cell and the row around it
// never rebuilds. The subscription dies with the cell, which is what stops a recycled cell writing
// into a node that now belongs to another row.
import { interval, Subscription, tap } from "rxjs"
import { Signal } from "@hafley66/signals"
import { mountInView, runWhenInView } from "@hafley66/docs-kit"
import { grid, render, type CellCtx, type ColumnDef, type Slot } from "../src/index.js"
import source from "./18_signal_slot.ts?raw"
import type { Example } from "./0_types.js"

interface Row {
  readonly id: string
  readonly name: string
  readonly base: number
}

const ROWS: readonly Row[] = Array.from({ length: 20 }, (_, i) => ({
  id: `r${i}`,
  name: `endpoint-${String(i).padStart(2, "0")}`,
  base: 40 + (i * 7) % 60,
}))

export const signalSlot: Example = {
  id: "signal-slot",
  title: "A slot returning a signal",
  summary: "One shared tick drives a per-cell derived signal, so latency repaints without a row rebuild.",
  feature: "view.slots",
  source,
  mount: (host) => mountInView(host, () => {
    const root = document.createElement("div")
    root.style.blockSize = "300px"
    host.append(root)
    const tick = Signal<number>(0)
    const latency: Slot<CellCtx<Row>> = (ctx) => {
      const seed = Number(ctx.value)
      return Signal<string>(() => `${(seed + Math.sin(tick.$() / 2 + seed) * 9).toFixed(1)} ms`)
    }
    const columns: readonly ColumnDef<Row>[] = [
      { id: "name", header: "Endpoint", flex: 1, minWidth: 200 },
      { id: "base", header: "Latency", width: 140, cell: latency },
    ]
    const g = grid<Row>({ id: "signal-slot", rows: ROWS, columns, rowId: (row) => row.id })
    const handle = render(g, root)
    const subs = new Subscription()
    subs.add(runWhenInView(interval(900).pipe(tap(() => tick.$(tick.$() + 1)))))
    return () => {
      subs.unsubscribe()
      handle.stop()
      g.close()
      root.remove()
    }
  }),
}
