// The second producer: real RxJS, run on a virtual clock.
//
// A demo is a plain object of observables and nothing else, so the thing an author writes is the
// thing RxJS would run. `TestScheduler` supplies the clock — inside `run` the async, interval,
// timeout, and animation-frame schedulers are all delegated to it, so `interval(1000)` written at
// module scope ticks in virtual milliseconds and no wall-clock time passes.
import { type Observable, type Subscription, takeUntil, tap, timer } from "rxjs"
import { TestScheduler } from "rxjs/testing"
import {
  MARBLES_VERSION,
  type MarbleDoc,
  type MarbleLane,
  type MarbleNotification,
  normalizeMarbleDoc,
} from "./0_types.js"

/** Lane id → the observable on that lane. Order is the object's key order unless `order` says otherwise. */
export type MarbleDemo = Record<string, Observable<unknown>>

export type RunMarblesOptions = {
  /** The window in virtual frames. A lane still running at the edge is unsubscribed, never completed. */
  frames?: number
  title?: string
  /** Display order; ids not listed follow in demo key order. */
  order?: readonly string[]
  /** Lane id → the lane it was derived from, drawn as indentation. */
  parents?: Readonly<Record<string, string>>
  /** Lane id → the label to draw. Defaults to the id. */
  labels?: Readonly<Record<string, string>>
  /** How a value becomes the string in the diagram. */
  format?: (value: unknown) => string
}

/**
 * The safety bound on a run, in virtual frames. Ten virtual seconds is longer than any diagram
 * anyone reads; a lane still running at the edge is cut and marked `unsubscribe`, so an unbounded
 * source says so in the diagram instead of hanging the process.
 */
export const DEFAULT_RUN_FRAMES = 10_000

const MAX_VALUE_CHARS = 24

export function defaultFormat(value: unknown): string {
  if (typeof value === "string") return value
  if (value === null || value === undefined) return String(value)
  // An Error stringifies to `{}`, which is the one value in a diagram that must not lose its text.
  if (value instanceof Error) return value.message
  let text: string
  if (typeof value === "object") {
    try {
      text = JSON.stringify(value) ?? String(value)
    } catch {
      text = Object.prototype.toString.call(value)
    }
  } else {
    text = String(value)
  }
  return text.length > MAX_VALUE_CHARS ? `${text.slice(0, MAX_VALUE_CHARS - 1)}…` : text
}

/**
 * Run a demo and record what every lane actually did.
 *
 * ```
 * const doc = runMarbleDemo(
 *   { clicks: fromEvent(button, "click"), requests: clicks.pipe(exhaustMap(fetch)) },
 *   { frames: 40, parents: { requests: "clicks" } },
 * )
 * ```
 */
export function runMarbleDemo(demo: MarbleDemo, options: RunMarblesOptions = {}): MarbleDoc {
  const frames = Math.max(1, options.frames ?? DEFAULT_RUN_FRAMES)
  const format = options.format ?? defaultFormat
  const ordered = options.order ?? []
  const ids = [...ordered.filter(id => id in demo), ...Object.keys(demo).filter(id => !ordered.includes(id))]
  const scheduler = new TestScheduler(() => undefined)
  const lanes: MarbleLane[] = []
  const subscriptions: Subscription[] = []

  scheduler.run(() => {
    for (const id of ids) {
      const source = demo[id]
      if (source === undefined) continue
      const notifications: MarbleNotification[] = [{ kind: "subscribe", frame: scheduler.frame }]
      // The lane's own window. A source that never ends is cut here, and the cut is recorded as an
      // unsubscribe so the diagram shows a subscription ending rather than a stream completing.
      let cut = false
      lanes.push({ id, label: options.labels?.[id] ?? id, parent: options.parents?.[id] ?? null, notifications })
      subscriptions.push(
        source
          .pipe(
            takeUntil(
              timer(frames).pipe(
                tap(() => {
                  cut = true
                }),
              ),
            ),
          )
          .subscribe({
            next: (value: unknown) =>
              notifications.push({ kind: "next", frame: scheduler.frame, value: format(value) }),
            error: (error: unknown) =>
              notifications.push({ kind: "error", frame: scheduler.frame, value: format(error) }),
            complete: () =>
              notifications.push(
                cut ? { kind: "unsubscribe", frame: scheduler.frame } : { kind: "complete", frame: scheduler.frame },
              ),
          }),
      )
    }
  })

  for (const subscription of subscriptions) subscription.unsubscribe()

  return normalizeMarbleDoc({
    version: MARBLES_VERSION,
    ...(options.title === undefined ? {} : { title: options.title }),
    // Normalization derives the extent from what was recorded; the window is a bound, not a length.
    frames: 1,
    lanes,
  })
}
