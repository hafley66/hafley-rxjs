// The renderer mounts no drag grip of its own, so the header slot supplies one carrying
// `moveAttrs()`. Its route chain is `g/h/move`, which is the template `moveColumnOnHeaderDrag`
// already listens on, so the epic needs no configuration to pick the gesture up.
import { Subscription, tap } from "rxjs"
import { mountInView, runWhenInView } from "@hafley66/docs-kit"
import { grid, moveAttrs, render } from "../src/index.js"
import type { ColumnDef, HeaderCtx, Renderable, Slot } from "../src/index.js"
import source from "./6_column_reorder.ts?raw"
import type { Example } from "./0_types.js"

interface Row {
  readonly id: string
  readonly name: string
  readonly size: number
  readonly kind: string
  readonly owner: string
}

const ROWS: readonly Row[] = Array.from({ length: 24 }, (_, i) => ({
  id: `r${i}`,
  name: `record-${String(i).padStart(2, "0")}`,
  size: (i * 89) % 700,
  kind: i % 2 === 0 ? "draft" : "final",
  owner: i % 3 === 0 ? "ana" : "bo",
}))

const COLUMNS: readonly ColumnDef<Row>[] = [
  { id: "name", header: "Name", width: 200 },
  { id: "size", header: "Size", width: 120 },
  { id: "kind", header: "Kind", width: 140 },
  { id: "owner", header: "Owner", width: 140 },
]

const headerSlot: Slot<HeaderCtx> = (ctx): Renderable => {
  const grip = document.createElement("span")
  grip.textContent = "⁙"
  grip.style.cursor = "grab"
  grip.style.touchAction = "none"
  for (const [name, value] of Object.entries(moveAttrs())) grip.setAttribute(name, value)
  const label = document.createElement("span")
  label.textContent = COLUMNS.find((col) => col.id === ctx.col)?.header ?? ctx.col
  return [grip, label]
}

export const columnReorder: Example = {
  id: "column-reorder",
  title: "Column reorder by drag",
  summary: "Drag a header grip sideways; one colOrder array moves the header band and every row band.",
  feature: "col.order",
  source,
  mount: (host) => mountInView(host, () => {
    const box = document.createElement("div")
    const readout = document.createElement("code")
    const root = document.createElement("div")
    root.style.blockSize = "300px"
    box.append(readout, root)
    host.append(box)
    const g = grid<Row>({
      id: "column-reorder",
      rows: ROWS,
      columns: COLUMNS,
      rowId: (row) => row.id,
      slots: { header: headerSlot },
      state: { colOrder: ["name", "size", "kind", "owner"] },
    })
    const handle = render(g, root)
    const subs = new Subscription()
    subs.add(runWhenInView(g.view.cols.$.pipe(tap((cols) => {
      readout.textContent = cols.map((node) => node.key).join(" → ")
    }))))
    return () => {
      subs.unsubscribe()
      handle.stop()
      g.close()
      box.remove()
    }
  }),
}
