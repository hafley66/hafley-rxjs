// The renderer owns the scroll box and feeds `g.viewport` from it, so scroll position is state the
// kernel reads rather than an event the consumer has to relay. Writing `scrollTop` on that box is
// the whole of scroll-into-view: the plan re-windows from the signal on the next frame.
import { fromEvent, Subscription, tap } from "rxjs"
import { grid, mountInView, render, ROW_HEIGHT, runWhenInView, type ColumnDef } from "../src/index.js"
import source from "./24_scroll_position.ts?raw"
import type { Example } from "./0_types.js"

interface Row {
  readonly id: string
  readonly name: string
  readonly value: number
}

const ROWS: readonly Row[] = Array.from({ length: 1200 }, (_, i) => ({
  id: `r${i}`,
  name: `frame-${String(i).padStart(4, "0")}`,
  value: (i * 331) % 5000,
}))

const COLUMNS: readonly ColumnDef<Row>[] = [
  { id: "name", header: "Frame", flex: 1, minWidth: 200 },
  { id: "value", header: "Value", width: 130 },
]

const TARGET = 900

export const scrollPosition: Example = {
  id: "scroll-position",
  title: "Scroll position as state",
  summary: "A button scrolls row nine hundred into view and the viewport readout follows the box.",
  feature: "view.scroll",
  source,
  mount: (host) => mountInView(host, () => {
    const box = document.createElement("div")
    const jump = document.createElement("button")
    jump.type = "button"
    jump.textContent = `scroll to row ${TARGET}`
    const label = document.createElement("code")
    const root = document.createElement("div")
    root.style.blockSize = "320px"
    box.append(jump, label, root)
    host.append(box)
    const g = grid<Row>({ id: "scroll-position", rows: ROWS, columns: COLUMNS, rowId: (row) => row.id })
    const handle = render(g, root)
    const subs = new Subscription()
    subs.add(runWhenInView(g.viewport.$.pipe(tap((viewport) => {
      label.textContent = `top ${Math.round(viewport.top)}, height ${Math.round(viewport.height)}`
    }))))
    const clicked$ = fromEvent(jump, "click")
    subs.add(runWhenInView(clicked$.pipe(tap(() => {
      const scroll = root.querySelector(".sg-scroll")
      if (scroll instanceof HTMLElement) scroll.scrollTop = TARGET * ROW_HEIGHT[g.state.density.$()]
    }))))
    return () => {
      subs.unsubscribe()
      handle.stop()
      g.close()
      box.remove()
    }
  }),
}
