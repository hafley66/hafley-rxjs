// `infinite` differs from `pages` in one rule: the window is `[0, (index + 1) * size)`, so pages
// accumulate instead of replacing each other. `pageOnScrollNearEnd` raises the index from scroll
// position rather than from a counter, so scrolling the same boundary twice raises it once.
import { Subscription } from "rxjs"
import { grid, render, type ColumnDef } from "../src/index.js"
import source from "./10_infinite_scroll.ts?raw"
import type { Example } from "./0_types.js"

interface Row {
  readonly id: string
  readonly name: string
  readonly depth: number
}

const ROWS: readonly Row[] = Array.from({ length: 2000 }, (_, i) => ({
  id: `r${i}`,
  name: `sample-${String(i).padStart(4, "0")}`,
  depth: (i * 53) % 400,
}))

const COLUMNS: readonly ColumnDef<Row>[] = [
  { id: "name", header: "Name", flex: 1, minWidth: 200 },
  { id: "depth", header: "Depth", width: 120 },
]

export const infiniteScroll: Example = {
  id: "infinite-scroll",
  title: "Infinite scroll",
  summary: "Twenty-five rows to start; scrolling toward the end admits the next page and keeps the last.",
  feature: "page.infinite",
  source,
  mount: (host) => {
    const box = document.createElement("div")
    const label = document.createElement("code")
    const root = document.createElement("div")
    root.style.blockSize = "320px"
    box.append(label, root)
    host.append(box)
    const g = grid<Row>({
      id: "infinite-scroll",
      rows: ROWS,
      columns: COLUMNS,
      rowId: (row) => row.id,
      overscan: 6,
      state: { page: { mode: "infinite", index: 0, size: 25, total: null } },
    })
    const handle = render(g, root)
    const subs = new Subscription()
    subs.add(g.state.page.$.subscribe((page) => {
      label.textContent = `${(page.index + 1) * page.size} of ${ROWS.length} rows admitted`
    }))
    return () => {
      subs.unsubscribe()
      handle.stop()
      box.remove()
    }
  },
}
