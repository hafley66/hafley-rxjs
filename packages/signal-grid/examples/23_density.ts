// Density is one state key resolving to pixels through `ROW_HEIGHT`, written onto the grid root as
// `--sg-row-h` on every geometry frame. Two densities are therefore one grid, not two.
import { fromEvent, Subscription } from "rxjs"
import { grid, mountInView, render, runWhenInView, type ColumnDef, type GridState } from "../src/index.js"
import source from "./23_density.ts?raw"
import type { Example } from "./0_types.js"

interface Row {
  readonly id: string
  readonly name: string
  readonly owner: string
  readonly size: number
}

const ROWS: readonly Row[] = Array.from({ length: 40 }, (_, i) => ({
  id: `r${i}`,
  name: `line-${String(i).padStart(2, "0")}`,
  owner: i % 2 === 0 ? "ana" : "bo",
  size: (i * 149) % 700,
}))

const COLUMNS: readonly ColumnDef<Row>[] = [
  { id: "name", header: "Name", flex: 1, minWidth: 180 },
  { id: "owner", header: "Owner", width: 120 },
  { id: "size", header: "Size", width: 110 },
]

const DENSITIES: readonly GridState["density"][] = ["compact", "standard", "comfortable"]

export const density: Example = {
  id: "density",
  title: "Density",
  summary: "Compact, standard, and comfortable are one state key resolving to twenty-eight, thirty-six, and forty-eight pixels.",
  feature: "view.density",
  source,
  mount: (host) => mountInView(host, () => {
    const box = document.createElement("div")
    const bar = document.createElement("div")
    const root = document.createElement("div")
    root.style.blockSize = "300px"
    box.append(bar, root)
    host.append(box)
    const g = grid<Row>({ id: "density", rows: ROWS, columns: COLUMNS, rowId: (row) => row.id })
    const handle = render(g, root)
    const subs = new Subscription()
    for (const value of DENSITIES) {
      const button = document.createElement("button")
      button.type = "button"
      button.textContent = value
      bar.append(button)
      subs.add(runWhenInView(fromEvent(button, "click"), () => g.state.density.$(value)))
    }
    return () => {
      subs.unsubscribe()
      handle.stop()
      g.close()
      box.remove()
    }
  }),
}
