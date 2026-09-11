// Every dimension and colour the renderer reads is a custom property on the grid root, so a retheme
// is one write and no class name is overridden. `--sg-row-h` is deliberately not among these: the
// renderer rewrites it from `ROW_HEIGHT[density]` on every geometry frame, so height is changed
// through `state.density` and colour through properties.
import { fromEvent, Subscription, tap } from "rxjs"
import { mountInView, runWhenInView } from "@hafley66/docs-kit"
import { grid, render, type ColumnDef } from "../src/index.js"
import source from "./19_theming.ts?raw"
import type { Example } from "./0_types.js"

interface Row {
  readonly id: string
  readonly name: string
  readonly owner: string
}

const ROWS: readonly Row[] = Array.from({ length: 24 }, (_, i) => ({
  id: `r${i}`,
  name: `ticket-${String(i).padStart(3, "0")}`,
  owner: i % 2 === 0 ? "ana" : "bo",
}))

const COLUMNS: readonly ColumnDef<Row>[] = [
  { id: "name", header: "Ticket", flex: 1, minWidth: 180 },
  { id: "owner", header: "Owner", width: 130 },
]

const THEMES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  default: {},
  ink: {
    "--sg-bg": "#101418",
    "--sg-fg": "#dbe4ee",
    "--sg-head-bg": "#161c22",
    "--sg-line": "#243039",
    "--sg-selected-bg": "#1f3a52",
    "--sg-pad": "14px",
  },
  paper: {
    "--sg-bg": "#fbf7ef",
    "--sg-fg": "#3a3227",
    "--sg-head-bg": "#f0e8d8",
    "--sg-line": "#ddd0b8",
    "--sg-selected-bg": "#f3e2b6",
    "--sg-pad": "10px",
  },
}

export const theming: Example = {
  id: "theming",
  title: "Theming by custom properties",
  summary: "Three palettes, each one a set of property writes on the grid root and no stylesheet edit.",
  feature: "view.theme",
  source,
  mount: (host) => mountInView(host, () => {
    const box = document.createElement("div")
    const bar = document.createElement("div")
    const root = document.createElement("div")
    root.style.blockSize = "300px"
    box.append(bar, root)
    host.append(box)
    const g = grid<Row>({
      id: "theming",
      rows: ROWS,
      columns: COLUMNS,
      rowId: (row) => row.id,
      state: { rowSelection: { r2: true, r3: true } },
    })
    const handle = render(g, root)
    const subs = new Subscription()
    let applied: readonly string[] = []
    for (const [name, vars] of Object.entries(THEMES)) {
      const button = document.createElement("button")
      button.type = "button"
      button.textContent = name
      bar.append(button)
      const clicked$ = fromEvent(button, "click")
      subs.add(runWhenInView(clicked$.pipe(tap(() => {
        for (const property of applied) root.style.removeProperty(property)
        for (const [property, value] of Object.entries(vars)) root.style.setProperty(property, value)
        applied = Object.keys(vars)
      }))))
    }
    return () => {
      subs.unsubscribe()
      handle.stop()
      g.close()
      box.remove()
    }
  }),
}
