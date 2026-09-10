// Every column in the schema reaches the document today, so the cell count per frame is rows times
// 300 and the `dom` timing is the one to watch; facet virtualization is what removes that.
import { interval, Subscription } from "rxjs"
import { grid, render, type ColumnDef } from "../src/index.js"
import source from "./28_wide_schema.ts?raw"
import type { Example } from "./0_types.js"

interface Row {
  readonly id: string
  readonly [field: string]: string | number
}

const COL_COUNT = 300
const ROW_COUNT = 200

const FIELDS: readonly string[] = Array.from({ length: COL_COUNT }, (_, index) => `f${String(index).padStart(3, "0")}`)

const buildRows = (): readonly Row[] =>
  Array.from({ length: ROW_COUNT }, (_, row) => {
    const record: Record<string, string | number> = { id: `r${row}`, name: `sample-${String(row).padStart(3, "0")}` }
    for (let index = 0; index < FIELDS.length; index++) {
      record[FIELDS[index] ?? ""] = (row * 31 + index * 17) % 997
    }
    return record as Row
  })

const COLUMNS: readonly ColumnDef<Row>[] = [
  { id: "name", header: "Sample", width: 160, pin: "start" },
  ...FIELDS.map((field): ColumnDef<Row> => ({ id: field, header: field, width: 90, type: "number", sortable: true })),
]

export const wideSchema: Example = {
  id: "stress-wide-schema",
  title: "Three hundred columns, scrolled sideways",
  summary:
    "A 300-column schema walked across its horizontal range on a timer. It is slow on purpose: the column axis is not virtualized yet, so all 300 cells per row are in the document, and this is the demo that proves facet virtualization when it lands.",
  feature: "view.virtualize.col",
  source,
  mount: (host) => {
    const box = document.createElement("div")
    const label = document.createElement("code")
    const root = document.createElement("div")
    root.style.blockSize = "360px"
    box.append(label, root)
    host.append(box)
    const rows = buildRows()
    const g = grid<Row>({
      id: "stress-wide-schema",
      rows,
      columns: COLUMNS,
      rowId: (it) => String(it.id),
    })
    const handle = render(g, root)
    const subs = new Subscription()
    subs.add(g.view.plan.$.subscribe((it) => {
      label.textContent = `${COLUMNS.length} columns, ${rows.length} rows, ${it.center.length} rows in the document`
    }))
    let step = 0
    subs.add(interval(100).subscribe(() => {
      const scroll = root.querySelector(".sg-scroll")
      if (!(scroll instanceof HTMLElement)) return
      step++
      const range = scroll.scrollWidth - scroll.clientWidth
      scroll.scrollLeft = range * ((step % 10) / 10)
    }))
    return () => {
      subs.unsubscribe()
      handle.stop()
      box.remove()
    }
  },
}
