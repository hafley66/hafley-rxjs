// `checkboxColumn` gives the seat, the width, the pinning, and the tri-state select-all glyph. It does
// not give the click: the factory's own glyph carries `checkAttrs()`, whose route is `g/r/check`,
// and a cell contributes a `c` segment, so a glyph mounted through a cell slot reads
// `g/r/c/check` and matches no declared template. One consumer-owned listener dispatches the
// intent instead, and `selectRowsOnCheckboxClick` then supplies the toggle and the shift range.
import { fromEvent, Subscription } from "rxjs"
import { checkboxColumn, grid, modifiersOf, render, type ColumnDef, type Grid } from "../src/index.js"
import source from "./12_row_selection.ts?raw"
import type { Example } from "./0_types.js"

interface Row {
  readonly id: string
  readonly name: string
  readonly size: number
}

const ROWS: readonly Row[] = Array.from({ length: 40 }, (_, i) => ({
  id: `r${i}`,
  name: `invoice-${String(i).padStart(3, "0")}`,
  size: (i * 409) % 1500,
}))

const DATA: readonly ColumnDef<Row>[] = [
  { id: "name", header: "Name", flex: 1, minWidth: 180 },
  { id: "size", header: "Amount", width: 130 },
]

const box = (): HTMLElement => {
  const span = document.createElement("span")
  span.className = "example-check"
  span.style.cursor = "pointer"
  span.textContent = "•"
  return span
}

export const rowSelection: Example = {
  id: "row-selection",
  title: "Row selection with the checkbox column",
  summary: "Click a mark to toggle a row, shift-click to fill the range; the header glyph is a live signal.",
  feature: "row.select",
  source,
  mount: (host) => {
    const root = document.createElement("div")
    root.style.blockSize = "320px"
    host.append(root)
    // Deferred, because the select-all toggle slot reads the grid the schema is being built for.
    let live: Grid<Row> | undefined
    const g = grid<Row>({
      id: "row-selection",
      rows: ROWS,
      columns: [checkboxColumn<Row>({ grid: () => live, cell: box }), ...DATA],
      rowId: (row) => row.id,
    })
    live = g
    const handle = render(g, root)
    const subs = new Subscription()
    subs.add(fromEvent<MouseEvent>(root, "click").subscribe((event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const row = target.closest(".example-check")?.closest("[data-route='r']")
      const id = row?.getAttribute("data-row-id")
      if (id === null || id === undefined) return
      g.dispatch({ phase: "intent", type: "checkbox.click", row: id, mods: modifiersOf(event) })
    }))
    return () => {
      subs.unsubscribe()
      handle.stop()
      root.remove()
    }
  },
}
