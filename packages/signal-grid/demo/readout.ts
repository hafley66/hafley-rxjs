// The panel that makes the kernel legible: what the relation holds, what the plan chose, and what
// the action stream just carried. Every number is read off `g` rather than off a copy the demo
// keeps, so a disagreement between this panel and the grid is a bug in the grid.
import { Subscription } from "rxjs"
import type { Grid, GridAction } from "../src/index.js"
import { h } from "./controls.js"

const LOG_LINES = 10
/** A full node count walks the tree, so it runs on a timer rather than on every scroll frame. */
const NODE_COUNT_MS = 400

export interface Readout {
  readonly el: HTMLElement
  readonly setLogScroll: (on: boolean) => void
  readonly stop: () => void
}

interface Stat {
  readonly label: string
  readonly value: HTMLElement
}

const stat = (host: HTMLElement, label: string): Stat => {
  const row = h("div", "stat")
  const name = h("span", "stat-label", label)
  const value = h("span", "stat-value", "0")
  row.append(name, value)
  host.append(row)
  return { label, value }
}

const num = (value: number): string => value.toLocaleString("en-US")

const summarize = <TRow>(action: GridAction<TRow>): string => {
  const rest: Record<string, unknown> = { ...(action as unknown as Record<string, unknown>) }
  delete rest["phase"]
  delete rest["type"]
  const body = JSON.stringify(rest)
  const trimmed = body.length > 52 ? `${body.slice(0, 52)}…` : body
  return `${action.phase} ${action.type} ${trimmed === "{}" ? "" : trimmed}`
}

export function readout<TRow>(g: Grid<TRow>, mount: HTMLElement): Readout {
  const el = h("div", "readout")

  const stats = h("div", "stats")
  el.append(h("h2", "group-title", "Relation"), stats)
  const totalRows = stat(stats, "rows in source")
  const groupedRows = stat(stats, "after grouping")
  const flatRows = stat(stats, "flat length")

  const planStats = h("div", "stats")
  el.append(h("h2", "group-title", "Plan"), planStats)
  const span = stat(planStats, "plan.span")
  const centerTotal = stat(planStats, "centerTotal")
  const offsetTop = stat(planStats, "offsetTop")
  const pinned = stat(planStats, "pinned start / end")
  const pageCount = stat(planStats, "pageCount")

  const domStats = h("div", "stats")
  el.append(h("h2", "group-title", "Document"), domStats)
  const renderedRows = stat(domStats, "rendered rows")
  const renderedCells = stat(domStats, "rendered cells")
  const domNodes = stat(domStats, "DOM nodes")

  const logBox = h("div", "log")
  el.append(h("h2", "group-title", "actions$"), logBox)
  const lines: HTMLElement[] = []
  for (let i = 0; i < LOG_LINES; i++) {
    const line = h("code", "log-line", " ")
    logBox.append(line)
    lines.push(line)
  }

  const history: string[] = []
  let logScroll = false
  let nodeCountAt = Number.NEGATIVE_INFINITY
  let nodes = 0
  let countedRows = -1
  let queued = false

  const paint = (): void => {
    queued = false
    const plan = g.view.plan.$()
    totalRows.value.textContent = num(g.view.base.$().by.size)
    groupedRows.value.textContent = num(g.view.grouped.$().by.size)
    flatRows.value.textContent = num(g.view.flat.$().length)
    span.value.textContent = `[${num(plan.span.start)}, ${num(plan.span.end)})`
    centerTotal.value.textContent = `${num(Math.round(plan.centerTotal))} px`
    offsetTop.value.textContent = `${num(Math.round(plan.offsetTop))} px`
    pinned.value.textContent = `${num(plan.start.length)} / ${num(plan.end.length)}`
    pageCount.value.textContent = num(plan.pageCount)

    const rows = mount.getElementsByClassName("sg-row").length
    const cells = mount.getElementsByClassName("sg-cell").length
    renderedRows.value.textContent = num(rows)
    renderedCells.value.textContent = num(cells)
    // A row count that moved means the tree moved, so the timer is skipped: the throttle exists
    // for a scroll that repaints the same shape, not for a frame that changed it.
    const now = performance.now()
    if (rows !== countedRows || now - nodeCountAt > NODE_COUNT_MS) {
      nodes = mount.getElementsByTagName("*").length
      nodeCountAt = now
      countedRows = rows
    }
    domNodes.value.textContent = num(nodes)

    for (let i = 0; i < LOG_LINES; i++) {
      lines[i]?.replaceChildren(history[i] ?? " ")
    }
  }

  // One frame per burst: a scroll writes the viewport, the plan recomputes, and both land here.
  const schedule = (): void => {
    if (queued) return
    queued = true
    requestAnimationFrame(paint)
  }

  const subs = new Subscription()
  subs.add(g.view.plan.$.subscribe(schedule))
  subs.add(g.state.$.subscribe(schedule))
  subs.add(
    g.actions$.subscribe((action) => {
      if (!logScroll && action.phase === "intent" && action.type === "viewport.scroll") return
      history.unshift(summarize(action))
      if (history.length > LOG_LINES) history.length = LOG_LINES
      schedule()
    }),
  )

  return {
    el,
    setLogScroll: (on) => { logScroll = on },
    stop: () => subs.unsubscribe(),
  }
}
