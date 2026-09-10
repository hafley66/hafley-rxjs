// `rows` takes any source shape, so a live stream and a static array are the same call. The sort
// model is applied to whatever the stream last emitted, which is why a row whose value crosses its
// neighbour's changes seat without anything re-declaring the sort.
import { map, timer, type Observable } from "rxjs"
import { grid, render, type ColumnDef } from "../src/index.js"
import source from "./16_observable_rows.ts?raw"
import type { Example } from "./0_types.js"

interface Row {
  readonly id: string
  readonly name: string
  readonly load: number
}

const SEED: readonly Row[] = Array.from({ length: 18 }, (_, i) => ({
  id: `r${i}`,
  name: `worker-${String(i).padStart(2, "0")}`,
  load: (i * 17) % 100,
}))

const COLUMNS: readonly ColumnDef<Row>[] = [
  { id: "name", header: "Worker", flex: 1, minWidth: 180, sortable: true },
  { id: "load", header: "Load", width: 110, sortable: true },
]

// `timer(0, ...)` rather than `interval`, so the first frame already has rows and the grid never
// paints its empty fallback.
const rows$: Observable<readonly Row[]> = timer(0, 1200).pipe(
  map((tick) => SEED.map((row, i) => ({ ...row, load: (row.load + tick * 13 + i * 3) % 100 }))),
)

export const observableRows: Example = {
  id: "observable-rows",
  title: "Reactive rows from an Observable",
  summary: "Rows arrive from a stream and re-sort themselves every tick with no imperative refresh.",
  feature: "row.sort",
  source,
  mount: (host) => {
    const root = document.createElement("div")
    root.style.blockSize = "300px"
    host.append(root)
    const g = grid<Row>({
      id: "observable-rows",
      rows: rows$,
      columns: COLUMNS,
      rowId: (row) => row.id,
      state: { sort: [{ field: "load", sort: "desc" }] },
    })
    const handle = render(g, root)
    return () => {
      handle.stop()
      root.remove()
    }
  },
}
