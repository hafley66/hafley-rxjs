// A detail panel is a real node in the row axis, so the scroll spacer, the window, and the rendered
// runs share one index space and a tall panel cannot drift the scroll on open. Its value is the
// row's own, which is what lets the panel's cell slot read the row it hangs under.
//
// The panel needs a height in `rowHeight` or the sizer measures it at the density default, so the
// height map is kept in step with the open set. The guard is what stops that write from feeding
// itself: a nested path emits on every root write whether or not its own branch moved.
import { Subscription, tap } from "rxjs"
import { defaultEpics, detailColumn, detailHeights, detailOnCellClick } from "../src/index.js"
import { grid, isDetailKey, mountInView, render, rowOfDetailKey, runWhenInView } from "../src/index.js"
import type { ColumnDef, RenderHandle } from "../src/index.js"
import source from "./14_detail_nested_grid.ts?raw"
import type { Example } from "./0_types.js"

interface Order {
  readonly id: string
  readonly customer: string
}
interface Line {
  readonly id: string
  readonly item: string
  readonly qty: number
}

const ORDERS: readonly Order[] = Array.from({ length: 12 }, (_, i) => ({
  id: `r${i}`,
  customer: `customer-${String(i).padStart(2, "0")}`,
}))

const LINES = (row: string): readonly Line[] =>
  Array.from({ length: 4 }, (_, i) => ({ id: `${row}-l${i}`, item: `part-${i}`, qty: i + 1 }))

const LINE_COLUMNS: readonly ColumnDef<Line>[] = [
  { id: "item", header: "Item", flex: 1, minWidth: 120 },
  { id: "qty", header: "Qty", width: 80 },
]

const PANEL_HEIGHT = 190

export const detailNestedGrid: Example = {
  id: "detail-nested-grid",
  title: "Detail panel hosting a nested grid",
  summary: "Click the disclosure to open a panel under a row; the panel is a second grid over that row's lines.",
  feature: "row.detail",
  source,
  mount: (host) => mountInView(host, () => {
    const root = document.createElement("div")
    root.style.blockSize = "360px"
    host.append(root)
    const panels = new Map<string, RenderHandle>()
    const openPanel = (row: string, into: HTMLElement): void => {
      panels.get(row)?.stop()
      const inner = grid<Line>({
        id: `lines-${row}`,
        rows: LINES(row),
        columns: LINE_COLUMNS,
        rowId: (line) => line.id,
        state: { virtualize: { vertical: false, horizontal: false } },
      })
      panels.set(row, render(inner, into))
    }
    const columns: readonly ColumnDef<Order>[] = [
      detailColumn<Order>({ cell: (ctx) => (isDetailKey(ctx.row) ? "" : "▶") }),
      {
        id: "customer",
        header: "Customer",
        width: 420,
        cell: (ctx) => {
          if (!isDetailKey(ctx.row)) return String(ctx.value)
          const panel = document.createElement("div")
          panel.style.blockSize = `${PANEL_HEIGHT - 20}px`
          panel.style.inlineSize = "100%"
          openPanel(rowOfDetailKey(ctx.row), panel)
          return panel
        },
      },
    ]
    const g = grid<Order>({
      id: "detail-nested-grid",
      rows: ORDERS,
      columns,
      rowId: (row) => row.id,
      epics: [...defaultEpics<Order>(), detailOnCellClick<Order>({ columns: ["__detail"] })],
      state: { detail: { r0: true }, rowHeight: detailHeights({ r0: true }, PANEL_HEIGHT) },
    })
    const handle = render(g, root)
    const subs = new Subscription()
    subs.add(runWhenInView(g.state.detail.$.pipe(tap((open) => {
      const next = detailHeights(open, PANEL_HEIGHT)
      const current = g.state.rowHeight.$()
      const keys = Object.keys(next)
      const same = keys.length === Object.keys(current).length && keys.every((k) => current[k] === next[k])
      if (!same) g.state.rowHeight.$(next)
    }))))
    return () => {
      subs.unsubscribe()
      for (const panel of panels.values()) panel.stop()
      panels.clear()
      handle.stop()
      g.close()
      root.remove()
    }
  }),
}
