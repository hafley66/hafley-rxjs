// The rows are built inside `mount` rather than at module scope, so teardown releases the heap they
// take and the receipts page can report a retained figure that means something.
import { interval, Subscription, tap } from "rxjs"
import { mountInView, runWhenInView } from "@hafley66/docs-kit"
import { grid, render, type ColumnDef } from "../src/index.js"
import source from "./25_tall_relation.ts?raw"
import type { Example } from "./0_types.js"

interface Row {
  readonly id: string
  readonly name: string
  readonly value: number
  readonly bucket: string
}

const ROW_COUNT = 500_000

const buildRows = (): readonly Row[] =>
  Array.from({ length: ROW_COUNT }, (_, index) => ({
    id: `r${index}`,
    name: `event-${String(index).padStart(6, "0")}`,
    value: (index * 2654435761) % 1_000_003,
    bucket: `b${index % 64}`,
  }))

const COLUMNS: readonly ColumnDef<Row>[] = [
  { id: "name", header: "Event", flex: 1, minWidth: 220 },
  { id: "value", header: "Value", width: 140, type: "number" },
  { id: "bucket", header: "Bucket", width: 110 },
]

// Fractions of the scroll range rather than pixel offsets: the range is a function of the density
// the grid is in, and a fixed pixel target would sit at the top on a taller row.
const STOPS: readonly number[] = [0.02, 0.25, 0.5, 0.75, 0.98, 0.5, 0]

export const tallRelation: Example = {
  id: "stress-tall-relation",
  title: "Half a million rows, scrolled hard",
  summary:
    "Five hundred thousand uniform rows with virtualization on, driven through seven scroll stops on a timer, so the frame and plan timings have a steady load to report.",
  feature: "view.virtualize.row",
  source,
  mount: (host) => mountInView(host, () => {
    const box = document.createElement("div")
    const label = document.createElement("code")
    const root = document.createElement("div")
    root.style.blockSize = "360px"
    box.append(label, root)
    host.append(box)
    const rows = buildRows()
    const g = grid<Row>({
      id: "stress-tall-relation",
      rows,
      columns: COLUMNS,
      rowId: (it) => it.id,
      overscan: 4,
    })
    const handle = render(g, root)
    const subs = new Subscription()
    subs.add(runWhenInView(g.view.plan.$.pipe(tap((it) => {
      label.textContent = `${rows.length} rows in the model, ${it.center.length} in the document, from index ${it.span.start}`
    }))))
    let stop = 0
    subs.add(runWhenInView(interval(140).pipe(tap(() => {
      const scroll = root.querySelector(".sg-scroll")
      if (!(scroll instanceof HTMLElement)) return
      const fraction = STOPS[stop % STOPS.length] ?? 0
      stop++
      scroll.scrollTop = (scroll.scrollHeight - scroll.clientHeight) * fraction
    }))))
    return () => {
      subs.unsubscribe()
      handle.stop()
      g.close()
      box.remove()
    }
  }),
}
