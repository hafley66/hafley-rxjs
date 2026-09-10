// `moveRowOnRowDrag` commits once, on pointerup, and only as an effect. The grid does not own source
// order, so a per-move change would ask the consumer to rewrite its data once per pointermove; the
// effect names the row and the row it should land before, and the consumer applies it.
import { Subscription } from "rxjs"
import { Signal } from "@hafley66/signals"
import { dragColumn, grid, render, type ColumnDef } from "../src/index.js"
import source from "./21_row_reorder.ts?raw"
import type { Example } from "./0_types.js"

interface Row {
  readonly id: string
  readonly name: string
  readonly rank: number
}

const SEED: readonly Row[] = Array.from({ length: 14 }, (_, i) => ({
  id: `r${i}`,
  name: `step-${String(i).padStart(2, "0")}`,
  rank: i,
}))

const DATA: readonly ColumnDef<Row>[] = [
  { id: "name", header: "Step", flex: 1, minWidth: 200 },
  { id: "rank", header: "Seeded rank", width: 140 },
]

export const rowReorder: Example = {
  id: "row-reorder",
  title: "Row reorder by drag",
  summary: "Drag the handle in the first column; the reorderRow effect rewrites the rows signal.",
  feature: "row.order",
  source,
  mount: (host) => {
    const root = document.createElement("div")
    root.style.blockSize = "300px"
    host.append(root)
    const rows = Signal<readonly Row[]>(SEED)
    const g = grid<Row>({
      id: "row-reorder",
      rows,
      columns: [dragColumn<Row>(), ...DATA],
      rowId: (row) => row.id,
      state: { virtualize: { vertical: false, horizontal: false } },
    })
    const handle = render(g, root)
    const subs = new Subscription()
    subs.add(g.effect$.subscribe((effect) => {
      if (effect.type !== "reorderRow") return
      const current = rows.$()
      const moved = current.find((row) => row.id === effect.row)
      if (moved === undefined) return
      const rest = current.filter((row) => row.id !== effect.row)
      const found = effect.before === null ? -1 : rest.findIndex((row) => row.id === effect.before)
      const at = found === -1 ? rest.length : found
      rows.$([...rest.slice(0, at), moved, ...rest.slice(at)])
    }))
    return () => {
      subs.unsubscribe()
      handle.stop()
      root.remove()
    }
  },
}
