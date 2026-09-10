// The receipt page for both e2e suites. `grid()` owns the state and `render()` owns the DOM, so a
// test measures what the package produces rather than markup this file typed out. Delegation still
// has its own claim to make, and it makes it against the same rendered tree: the ancestors carrying
// `gridId` and `rowId` are now the renderer's row and root elements.
import { Signal } from "@hafley66/signals"
import {
  grid,
  render,
  gridDom,
  intentOf,
  type ColumnDef,
  type Grid,
  type GridState,
  type Viewport,
} from "../src/index.js"
import "../src/theme.css"

const GRID = "files"

interface FileRow {
  readonly id: string
  readonly name: string
  readonly size: number
  readonly mtime: string
  readonly kids?: readonly FileRow[]
}

const leaf = (id: string, name: string, size: number, mtime: string): FileRow =>
  ({ id, name, size, mtime })

// Three roots, and every other row hangs under the first one collapsed. The delegation suite counts
// rows and cells on load, so the row count on load has to stay three while the relation stays big
// enough that a page index above zero and a nested expand both have somewhere to go.
const ROWS: readonly FileRow[] = [
  {
    id: "src/a.ts",
    name: "a.ts",
    size: 1024,
    mtime: "2026-09-01",
    kids: [
      leaf("src/a/one.ts", "one.ts", 11, "2026-09-02"),
      leaf("src/a/two.ts", "two.ts", 22, "2026-09-03"),
      leaf("src/a/three.ts", "three.ts", 33, "2026-09-04"),
      leaf("src/a/four.ts", "four.ts", 44, "2026-09-05"),
      leaf("src/a/five.ts", "five.ts", 55, "2026-09-06"),
      {
        id: "src/a/nested",
        name: "nested",
        size: 66,
        mtime: "2026-09-07",
        kids: [
          leaf("src/a/nested/x.ts", "x.ts", 1, "2026-09-08"),
          leaf("src/a/nested/y.ts", "y.ts", 2, "2026-09-09"),
          leaf("src/a/nested/z.ts", "z.ts", 3, "2026-09-10"),
        ],
      },
    ],
  },
  leaf("src/b.ts", "b.ts", 2048, "2026-08-30"),
  leaf("src/c.ts", "c.ts", 4096, "2026-08-29"),
]

const COLUMNS: readonly ColumnDef<FileRow>[] = [
  { id: "name", header: "Name", width: 200 },
  { id: "size", header: "Size", width: 100 },
  { id: "mtime", header: "Modified", width: 140 },
]

export interface Observed {
  readonly route: "cell" | "header"
  readonly params: Record<string, string>
  readonly intent: unknown
}

export interface PlanShape {
  readonly start: readonly string[]
  readonly center: readonly string[]
  readonly end: readonly string[]
  readonly centerTotal: number
  readonly offsetTop: number
}

declare global {
  interface Window {
    __events: Observed[]
    __sharedStream: boolean
    __grid: Grid<FileRow>
    __patch: (patch: Partial<GridState>) => void
    __plan: () => PlanShape
  }
}

// The delegation suite clicks a descendant of a cell to prove the route climbs past elements that
// carry no route of their own. The built-in cell renderer appends bare text, so the slot supplies
// the one element that click needs.
const label = (text: string): HTMLElement => {
  const el = document.createElement("span")
  el.className = "label"
  el.textContent = text
  return el
}

const mount = document.querySelector("#mount") as HTMLElement

const viewport = Signal<Viewport>({ top: 0, left: 0, width: 900, height: 320 })

const g = grid<FileRow>({
  id: GRID,
  rows: ROWS,
  columns: COLUMNS,
  rowId: (row) => row.id,
  subRows: (row) => row.kids,
  // A plain object is dropped: `grid()` only reads `config.state` when it is a signal.
  state: Signal<Partial<GridState>>({
    // Off so the rendered run equals the page run. A test that measures every row the plan named
    // would otherwise be measuring whatever the scroll position happened to leave mounted.
    virtualize: { vertical: false, horizontal: false },
    // A third column that starts hidden, so the load-time cell count stays at two per row and the
    // column tests still have something to unhide.
    colHidden: { mtime: true },
  }),
  viewport,
  slots: { cell: (ctx) => label(String(ctx.value ?? "")) },
})

render(g, mount)

// The kernel takes viewport size as an input and measures nothing itself, so the page supplies it.
const scroll = mount.querySelector(".sg-scroll")
if (scroll !== null) {
  const observer = new ResizeObserver((entries) => {
    const box = entries[0]?.contentRect
    if (box === undefined) return
    viewport.$({ ...viewport.$(), width: box.width, height: box.height })
  })
  observer.observe(scroll)
}

window.__grid = g
window.__patch = (patch) => {
  g.state.$({ ...g.state.$(), ...patch })
}
window.__plan = () => {
  const plan = g.view.plan.$()
  return {
    start: [...plan.start],
    center: [...plan.center],
    end: [...plan.end],
    centerTotal: plan.centerTotal,
    offsetTop: plan.offsetTop,
  }
}

function record(observed: Observed): void {
  window.__events.push(observed)
  const target = document.querySelector("#observed")
  if (target) target.textContent = JSON.stringify(observed.params)
}

window.__events = []

const dom = gridDom(GRID)

// `Dom` caches by template, so two grid ids share one delegated listener per event name: the page
// carries two listeners whatever the row count. Recorded here because it needs a live document.
window.__sharedStream = dom.cell.route.click === gridDom("other").cell.route.click

dom.cell.route.click.subscribe(event => {
  record({ route: "cell", params: { ...event.params }, intent: intentOf["cell.click"](event) })
})

dom.header.route.click.subscribe(event => {
  record({ route: "header", params: { ...event.params }, intent: intentOf["header.click"](event) })
})

// The test waits on this instead of a timeout: the grid is mounted and both subscriptions are live.
document.documentElement.setAttribute("data-fixture", "ready")
