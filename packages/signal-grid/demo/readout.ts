// The panel that makes the kernel legible: what the relation holds, what the plan chose, and what
// the action stream just carried. Every stat names the signal it reads, so nothing is refreshed.
import { animationFrameScheduler, auditTime, filter, map, merge, Observable, scan, tap } from "rxjs"
import { Signal } from "@hafley66/signals"
import { mountInView, runWhenInView } from "@hafley66/docs-kit"
import { type Grid, type GridAction } from "../src/index.js"
import { afterPaint, h } from "./controls.js"

const LOG_LINES = 10
/** A full node count walks the tree, so it runs on a timer rather than on every scroll frame. */
const NODE_COUNT_MS = 400

export interface Readout {
  readonly el: HTMLElement
  readonly stop: () => void
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

export function readout<TRow>(
  g: Grid<TRow>,
  mount: HTMLElement,
  logScroll: Signal<boolean> = Signal<boolean>(false),
): Readout {
  const el = h("div", "readout")

  const stat = (host: HTMLElement, label: string, text: Observable<string>): Observable<unknown> => {
    const row = h("div", "stat")
    const value = h("span", "stat-value", "0")
    row.append(h("span", "stat-label", label), value)
    host.append(row)
    return text.pipe(tap((it) => { value.textContent = it }))
  }

  /** Text derived from state. The memo tracks whatever it read, so a stat names its own source. */
  const derived = (read: () => string): Observable<string> => Signal<string>(read).$

  const painted$ = afterPaint(g.view.plan.$)
  const painted = (read: () => string): Observable<string> => painted$.pipe(map(read))

  const stats = h("div", "stats")
  el.append(h("h2", "group-title", "Relation"), stats)
  const relation$ = merge(
    stat(stats, "rows in source", derived(() => num(g.view.base.$().by.size))),
    stat(stats, "after grouping", derived(() => num(g.view.grouped.$().by.size))),
    stat(stats, "flat length", derived(() => num(g.view.flat.$().length))),
  )

  const planStats = h("div", "stats")
  el.append(h("h2", "group-title", "Plan"), planStats)
  const plan$ = merge(
    stat(planStats, "plan.span", derived(() => {
      const span = g.view.plan.$().span
      return `[${num(span.start)}, ${num(span.end)})`
    })),
    stat(planStats, "centerTotal", derived(() => `${num(Math.round(g.view.plan.$().centerTotal))} px`)),
    stat(planStats, "offsetTop", derived(() => `${num(Math.round(g.view.plan.$().offsetTop))} px`)),
    stat(planStats, "pinned start / end", derived(() => {
      const plan = g.view.plan.$()
      return `${num(plan.start.length)} / ${num(plan.end.length)}`
    })),
    stat(planStats, "pageCount", derived(() => num(g.view.plan.$().pageCount))),
  )

  let nodeCountAt = Number.NEGATIVE_INFINITY
  let nodes = 0
  let countedRows = -1

  // A row count that moved means the tree moved, so the timer is skipped: the throttle exists for
  // a scroll that repaints the same shape rather than for a frame that changed it.
  const domNodeCount = (): string => {
    const rows = mount.getElementsByClassName("sg-row").length
    const now = performance.now()
    if (rows !== countedRows || now - nodeCountAt > NODE_COUNT_MS) {
      nodes = mount.getElementsByTagName("*").length
      nodeCountAt = now
      countedRows = rows
    }
    return num(nodes)
  }

  const domStats = h("div", "stats")
  el.append(h("h2", "group-title", "Document"), domStats)
  const document$ = merge(
    stat(domStats, "rendered rows", painted(() => num(mount.getElementsByClassName("sg-row").length))),
    stat(domStats, "rendered cells", painted(() => num(mount.getElementsByClassName("sg-cell").length))),
    stat(domStats, "DOM nodes", painted(domNodeCount)),
  )

  const logBox = h("div", "log")
  el.append(h("h2", "group-title", "actions$"), logBox)
  const lines: HTMLElement[] = []
  for (let i = 0; i < LOG_LINES; i++) {
    const line = h("code", "log-line", " ")
    logBox.append(line)
    lines.push(line)
  }

  // The tail is the pipeline's own accumulator, so no array outside it holds what was logged.
  const log$ = g.actions$.pipe(
    filter((it) => logScroll.$() || !(it.phase === "intent" && it.type === "viewport.scroll")),
    scan((carry: readonly string[], it) => [summarize(it), ...carry].slice(0, LOG_LINES), []),
    auditTime(0, animationFrameScheduler),
    tap((history) => {
      for (let i = 0; i < LOG_LINES; i++) lines[i]?.replaceChildren(history[i] ?? " ")
    }),
  )

  // The box being reported on is the gate: a readout of a grid nobody is looking at is a frame per
  // burst spent on numbers nobody reads.
  const panel$ = merge(relation$, plan$, document$, log$)
  const stop = mountInView(mount, () => runWhenInView(panel$))

  return { el, stop }
}
