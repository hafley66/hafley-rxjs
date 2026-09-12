// The panel that makes the kernel legible: what the relation holds, what the plan chose, and what
// the action stream just carried. Every stat names the signal it reads, so nothing is refreshed.
import { animationFrameScheduler, auditTime, defer, filter, map, merge, Observable, scan, shareReplay, tap } from "rxjs"
import { Signal } from "@hafley66/signals"
import { mountInView, runWhenInView } from "@hafley66/docs-kit"
import { type Grid, type GridAction } from "../src/index.js"
import { afterPaint, h } from "./controls.js"

const LOG_LINES = 10
/** A full node count walks the tree, so it runs on a timer rather than on every scroll frame. */
const NODE_COUNT_MS = 400

/** Frames kept in the rolling average. 90 at 60 Hz is a second and a half, long enough that one
 * stutter shows and short enough that the number follows the hand. */
const FRAME_WINDOW = 90
/** Two 60 Hz budgets. A gap past this is a frame the browser was asked for and did not draw. */
const SLOW_FRAME_MS = 32
/** The meter samples every frame; only the text it writes is throttled. */
const FRAME_TEXT_MS = 250

export interface FrameStats {
  readonly fps: number
  /** The longest gap still in the window, in milliseconds. */
  readonly worst: number
  /** Gaps past `SLOW_FRAME_MS` since the meter started. */
  readonly slow: number
}

/** Milliseconds between paints. The teardown cancels the pending frame, so a demo scrolled out of
 * view stops asking for them. */
const frameGaps = (): Observable<number> =>
  new Observable<number>((observer) => {
    let previous = performance.now()
    let id = requestAnimationFrame(function step(now: number): void {
      observer.next(now - previous)
      previous = now
      id = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(id)
  })

/** One ring per subscription rather than a growing array, so reading the meter costs one write and
 * one 90-step sum per frame instead of an allocation. */
const frameStats = (): Observable<FrameStats> =>
  defer(() => {
    const gaps = new Float64Array(FRAME_WINDOW)
    let at = 0
    let filled = 0
    let slow = 0
    return frameGaps().pipe(
      map((gap): FrameStats => {
        gaps[at] = gap
        at = (at + 1) % FRAME_WINDOW
        if (filled < FRAME_WINDOW) filled += 1
        if (gap > SLOW_FRAME_MS) slow += 1
        let total = 0
        let worst = 0
        for (let i = 0; i < filled; i++) {
          const it = gaps[i] ?? 0
          total += it
          if (it > worst) worst = it
        }
        return { fps: total === 0 ? 0 : (1000 * filled) / total, worst, slow }
      }),
    )
  })

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

  // Scroll is where this kernel is judged, and a rendered-cell count says nothing about whether
  // the browser drew them in time. One rAF loop, three readings off it.
  const frameBox = h("div", "stats")
  el.append(h("h2", "group-title", "Frames"), frameBox)
  const held$ = frameStats().pipe(
    auditTime(FRAME_TEXT_MS),
    shareReplay({ bufferSize: 1, refCount: true }),
  )
  const frames$ = merge(
    stat(frameBox, "fps", held$.pipe(map((it) => it.fps.toFixed(0)))),
    stat(frameBox, "worst frame", held$.pipe(map((it) => `${it.worst.toFixed(1)} ms`))),
    stat(frameBox, `frames over ${SLOW_FRAME_MS} ms`, held$.pipe(map((it) => num(it.slow)))),
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
  const panel$ = merge(relation$, plan$, document$, frames$, log$)
  const stop = mountInView(mount, () => runWhenInView(panel$))

  return { el, stop }
}
