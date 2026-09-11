// Server mode skips grouping and sorting locally and publishes `g.query` instead. The fetch answers
// it and writes `rows`; the kernel treats what came back as the resolved page.
//
// `infinite` is the paging rule that lets the caller answer with the whole prefix `[0, loaded)`,
// which is exactly what the local window then asks for, so the two agree with no second slice.
import { Subscription } from "rxjs"
import { Signal } from "@hafley66/signals"
import { grid, mountInView, render, runWhenInView, type ColumnDef, type QueryDescriptor } from "../src/index.js"
import source from "./15_server_mode.ts?raw"
import type { Example } from "./0_types.js"

interface Row {
  readonly id: string
  readonly name: string
  readonly size: number
}

const TABLE: readonly Row[] = Array.from({ length: 900 }, (_, i) => ({
  id: `r${i}`,
  name: `record-${String(i).padStart(3, "0")}`,
  size: (i * 1913) % 9000,
}))

const COLUMNS: readonly ColumnDef<Row>[] = [
  { id: "name", header: "Name", flex: 1, minWidth: 200, sortable: true },
  { id: "size", header: "Size", width: 130, sortable: true },
]

const read = (row: Row, field: string): string | number => (field === "size" ? row.size : row.name)

/** Stands in for the network. Sorts and slices upstream, which is the half the grid no longer does. */
const fetchPage = (query: QueryDescriptor): readonly Row[] => {
  const item = query.sort[0]
  const ordered =
    item === undefined
      ? TABLE
      : [...TABLE].sort((a, b) => {
          const left = read(a, item.field)
          const right = read(b, item.field)
          const order = left < right ? -1 : left > right ? 1 : 0
          return item.sort === "asc" ? order : -order
        })
  return ordered.slice(0, (query.page.index + 1) * query.page.size)
}

export const serverMode: Example = {
  id: "server-mode",
  title: "Server mode driven by g.query",
  summary: "Sorting and paging leave the browser: every query emission is one fetch, and rows are the answer.",
  feature: "page.server",
  source,
  mount: (host) => mountInView(host, () => {
    const box = document.createElement("div")
    const label = document.createElement("code")
    const root = document.createElement("div")
    root.style.blockSize = "320px"
    box.append(label, root)
    host.append(box)
    const rows = Signal<readonly Row[]>([])
    const g = grid<Row>({
      id: "server-mode",
      mode: "server",
      rows,
      columns: COLUMNS,
      rowId: (row) => row.id,
      rowCount: TABLE.length,
      overscan: 6,
      state: {
        page: { mode: "infinite", index: 0, size: 40, total: TABLE.length },
        sort: [{ field: "size", sort: "desc" }],
      },
    })
    const handle = render(g, root)
    const subs = new Subscription()
    subs.add(runWhenInView(g.query.$, (query) => {
      const page = fetchPage(query)
      rows.$(page)
      const item = query.sort[0]
      label.textContent = `fetched ${page.length} of ${TABLE.length}, sorted by ${item?.field ?? "nothing"}`
    }))
    return () => {
      subs.unsubscribe()
      handle.stop()
      g.close()
      box.remove()
    }
  }),
}
