// Paging is one operator with three retention rules, so `pages` is a state write rather than a
// second code path. `plan.pageCount` is reported off the whole center run, which is what lets a
// pager know how many pages exist while only one page is windowed.
import { fromEvent, Subscription } from "rxjs"
import { grid, render, type ColumnDef } from "../src/index.js"
import source from "./9_pagination.ts?raw"
import type { Example } from "./0_types.js"

interface Row {
  readonly id: string
  readonly name: string
  readonly size: number
}

const ROWS: readonly Row[] = Array.from({ length: 137 }, (_, i) => ({
  id: `r${i}`,
  name: `entry-${String(i).padStart(3, "0")}`,
  size: (i * 719) % 2000,
}))

const COLUMNS: readonly ColumnDef<Row>[] = [
  { id: "name", header: "Name", flex: 1, minWidth: 180 },
  { id: "size", header: "Size", width: 120 },
]

const PAGE_SIZE = 12

export const pagination: Example = {
  id: "pagination",
  title: "Pagination",
  summary: "Twelve rows at a time out of one hundred and thirty-seven, with the page count read off the plan.",
  feature: "page.paginate",
  source,
  mount: (host) => {
    const box = document.createElement("div")
    const previous = document.createElement("button")
    const next = document.createElement("button")
    const label = document.createElement("code")
    previous.type = "button"
    previous.textContent = "prev"
    next.type = "button"
    next.textContent = "next"
    const root = document.createElement("div")
    root.style.blockSize = "300px"
    box.append(previous, next, label, root)
    host.append(box)
    const g = grid<Row>({
      id: "pagination",
      rows: ROWS,
      columns: COLUMNS,
      rowId: (row) => row.id,
      state: { page: { mode: "pages", index: 0, size: PAGE_SIZE, total: null }, virtualize: false },
    })
    const handle = render(g, root)
    const subs = new Subscription()
    let pages = 1
    subs.add(g.view.plan.$.subscribe((plan) => {
      pages = Math.max(1, plan.pageCount)
      label.textContent = `page ${g.state.page.$().index + 1} of ${pages}`
    }))
    const step = (delta: number): void => {
      const page = g.state.page.$()
      const index = Math.min(pages - 1, Math.max(0, page.index + delta))
      if (index !== page.index) g.state.page.$({ ...page, index })
    }
    subs.add(fromEvent(previous, "click").subscribe(() => step(-1)))
    subs.add(fromEvent(next, "click").subscribe(() => step(1)))
    return () => {
      subs.unsubscribe()
      handle.stop()
      box.remove()
    }
  },
}
