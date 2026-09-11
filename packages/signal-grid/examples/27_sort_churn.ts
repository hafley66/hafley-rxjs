// Two writers race on purpose: the sort key flips every 200 ms while the scroll box moves every
// 60 ms, so `sort`, `flatten` and `plan` all re-run against a viewport that never settles.
import { interval, Subscription, tap } from "rxjs"
import { mountInView, runWhenInView } from "@hafley66/docs-kit"
import { grid, render, type ColumnDef, type SortModel } from "../src/index.js"
import source from "./27_sort_churn.ts?raw"
import type { Example } from "./0_types.js"

interface Row {
  readonly id: string
  readonly name: string
  readonly size: number
  readonly kind: string
  readonly score: number
}

const KINDS = ["audio", "document", "image", "video"] as const

const ROW_COUNT = 20_000

const buildRows = (): readonly Row[] =>
  Array.from({ length: ROW_COUNT }, (_, index) => ({
    id: `r${index}`,
    name: `asset-${String(index).padStart(5, "0")}`,
    size: (index * 613) % 90_000,
    kind: KINDS[index % KINDS.length] ?? "audio",
    score: (index * 7919) % 1000,
  }))

const COLUMNS: readonly ColumnDef<Row>[] = [
  { id: "name", header: "Name", flex: 1, minWidth: 200, sortable: true },
  { id: "kind", header: "Kind", width: 120, sortable: true },
  { id: "size", header: "Size", width: 120, type: "number", sortable: true },
  { id: "score", header: "Score", width: 110, type: "number", sortable: true },
]

const KEYS: readonly SortModel[] = [
  [{ field: "size", sort: "asc" }],
  [{ field: "score", sort: "desc" }],
  [{ field: "kind", sort: "asc" }, { field: "size", sort: "desc" }],
  [{ field: "name", sort: "desc" }],
]

export const sortChurn: Example = {
  id: "stress-sort-churn",
  title: "A sort key flipped under a moving scroll box",
  summary:
    "Twenty thousand rows re-sorted every 200 ms through four different keys while the viewport walks the scroll range, which is the worst case for the sort and flatten stages.",
  feature: "row.sort",
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
      id: "stress-sort-churn",
      rows,
      columns: COLUMNS,
      rowId: (it) => it.id,
      state: { sort: KEYS[0] ?? [] },
    })
    const handle = render(g, root)
    const subs = new Subscription()
    let writes = 0
    subs.add(runWhenInView(g.state.sort.$.pipe(tap((it) => {
      const first = it[0]
      label.textContent = `${rows.length} rows, ${writes} sort writes, key ${first === undefined ? "none" : `${first.field} ${first.sort}`}`
    }))))
    subs.add(runWhenInView(interval(200).pipe(tap(() => {
      writes++
      g.state.sort.$(KEYS[writes % KEYS.length] ?? [])
    }))))
    let step = 0
    subs.add(runWhenInView(interval(60).pipe(tap(() => {
      const scroll = root.querySelector(".sg-scroll")
      if (!(scroll instanceof HTMLElement)) return
      step++
      const range = scroll.scrollHeight - scroll.clientHeight
      scroll.scrollTop = range * ((step % 20) / 20)
    }))))
    return () => {
      subs.unsubscribe()
      handle.stop()
      g.close()
      box.remove()
    }
  }),
}
