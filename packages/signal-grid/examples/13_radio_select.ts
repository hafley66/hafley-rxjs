// `radioColumn` marks the schema as single select, and `rowSelectionMode()` is what reads that back.
// The default epic set toggles many, so single select replaces one epic rather than configuring it:
// every other epic is exported alone precisely so a consumer can swap exactly the one it disagrees
// with and keep the rest.
import { filter, fromEvent, map, Subscription } from "rxjs"
import { activateOnCellClick, grid, keyboardNav, modifiersOf, radioColumn } from "../src/index.js"
import { mountInView, render, rowSelectionMode, runWhenInView, sortOnHeaderClick } from "../src/index.js"
import type { ColumnDef, GridAction, GridEpic, GridIntent } from "../src/index.js"
import source from "./13_radio_select.ts?raw"
import type { Example } from "./0_types.js"

interface Row {
  readonly id: string
  readonly name: string
  readonly plan: string
}

const ROWS: readonly Row[] = Array.from({ length: 24 }, (_, i) => ({
  id: `r${i}`,
  name: `account-${String(i).padStart(2, "0")}`,
  plan: i % 3 === 0 ? "team" : "solo",
}))

const DATA: readonly ColumnDef<Row>[] = [
  { id: "name", header: "Name", flex: 1, minWidth: 180 },
  { id: "plan", header: "Plan", width: 120 },
]

const singleSelect = <TRow,>(): GridEpic<TRow> => (actions$, state, ctx) =>
  actions$.pipe(
    filter((a): a is Extract<GridIntent, { type: "checkbox.click" }> =>
      a.phase === "intent" && a.type === "checkbox.click",
    ),
    map((a): GridAction<TRow> => ({
      phase: "change",
      type: "rowSelection",
      rowSelection:
        rowSelectionMode(ctx.columns.$()) === "single"
          ? { [a.row]: true }
          : { ...state.rowSelection.$(), [a.row]: state.rowSelection.$()[a.row] !== true },
    })),
  )

const mark = (): HTMLElement => {
  const span = document.createElement("span")
  span.className = "example-radio"
  span.style.cursor = "pointer"
  span.textContent = "◦"
  return span
}

export const radioSelect: Example = {
  id: "radio-select",
  title: "Radio single-select",
  summary: "One row selected at a time, enforced by an epic that reads rowSelectionMode off the schema.",
  feature: "row.select",
  source,
  mount: (host) => mountInView(host, () => {
    const root = document.createElement("div")
    root.style.blockSize = "300px"
    host.append(root)
    const g = grid<Row>({
      id: "radio-select",
      rows: ROWS,
      columns: [radioColumn<Row>({ cell: mark }), ...DATA],
      rowId: (row) => row.id,
      epics: [sortOnHeaderClick<Row>(), activateOnCellClick<Row>(), keyboardNav<Row>(), singleSelect<Row>()],
    })
    const handle = render(g, root)
    const subs = new Subscription()
    subs.add(runWhenInView(fromEvent<MouseEvent>(root, "click"), (event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const id = target.closest(".example-radio")?.closest("[data-route='r']")?.getAttribute("data-row-id")
      if (id === null || id === undefined) return
      g.dispatch({ phase: "intent", type: "checkbox.click", row: id, mods: modifiersOf(event) })
    }))
    return () => {
      subs.unsubscribe()
      handle.stop()
      g.close()
      root.remove()
    }
  }),
}
