// The second producer: real RxJS, run on a virtual clock, with the causal turn recorded.
//
// `TestScheduler.run` drains its own queue and leaves no seam, so this module drains it instead:
// one action per column, and every notification that happens during an action lands on that column.
// `of(1,2,3)` is therefore one column and `of(1,2,3).pipe(observeOn(asapScheduler))` is three, which
// is the difference the whole axis exists to show.
//
// Higher-order operators are recorded without being reimplemented: the project's result is wrapped
// in an Observable that records its own subscription, its values, and its fate, and the real
// operator does the subscribing. `switchMap` cancelling an inner is then observable as an
// `unsubscribe` on that inner's own lane — which is the thing a diagram of `switchMap` has to say.
import {
  concatMap,
  exhaustMap,
  expand,
  from,
  mergeMap,
  mergeScan,
  Observable,
  type ObservableInput,
  type Subscription,
  share,
  switchMap,
  switchScan,
} from "rxjs"
import { TestScheduler } from "rxjs/testing"
import {
  LaneIdSchema,
  MARBLES_VERSION,
  type MarbleBirth,
  type MarbleDoc,
  type MarbleLane,
  marbleEventId,
  normalizeMarbleDoc,
} from "./0_types.js"

/** Lane id → the observable on that lane. Order is the object's key order unless `order` says otherwise. */
export type MarbleDemo = Record<string, Observable<unknown>>

/** The highest-order operator a lane can be built from. It picks the real rxjs operator. */
export type InnerOp = "merge" | "switch" | "concat" | "exhaust" | "expand"

export type LaneOptions = {
  /** The label to draw. Defaults to the id. */
  label?: string
  /** The lane this one is read through, drawn as indentation. */
  parent?: string
}

export type EachOptions = LaneOptions & {
  /** Which higher-order operator to build. Defaults to `merge` (`mergeMap`). */
  op?: InnerOp
  /** The inner lanes' id prefix: `request` gives `request1`, `request2`, … */
  name?: string
  /** `mergeScan`/`switchScan`: the accumulator's seed. Supplying one is what selects the scan form. */
  seed?: unknown
  /** The name an inner lane is drawn with, from the value that started it. */
  innerLabel?: (value: unknown, ordinal: number) => string
}

/** What a higher-order lane does with each value: the inner observable, as the author writes it. */
export type InnerProject = (value: unknown, index: number) => ObservableInput<unknown>

export type RunMarblesOptions = {
  /** The window in virtual milliseconds. Lanes still running at the edge are cut, never completed. */
  windowMs?: number
  /** The window in columns. A turn per millisecond would otherwise be a ten-thousand-column document. */
  maxColumns?: number
  title?: string
  /** Display order; ids not listed follow in declaration order. */
  order?: readonly string[]
  /** Lane id → the lane it was derived from. */
  parents?: Readonly<Record<string, string>>
  /** Lane id → the label to draw. Defaults to the id. */
  labels?: Readonly<Record<string, string>>
  /** How a value becomes the string in the diagram. */
  format?: (value: unknown) => string
}

/** Something the run could not capture, said out loud instead of drawn as if it were true. */
export type MarbleDiagnostic = {
  lane: string
  code: "silent" | "overflow"
  message: string
}

export type MarbleRun = { doc: MarbleDoc; diagnostics: MarbleDiagnostic[] }

/**
 * The safety bounds on a run. Ten virtual seconds is longer than any diagram anyone reads, and no
 * one reads 500 causal turns; a lane still running at either edge is cut and marked `truncate`.
 */
export const DEFAULT_WINDOW_MS = 10_000
export const DEFAULT_MAX_COLUMNS = 512
const MAX_LANE_NOTIFICATIONS = 256

const MAX_VALUE_CHARS = 24

export function defaultFormat(value: unknown): string {
  if (value === null || value === undefined) return String(value)
  const text = typeof value === "string" ? value : safeStringify(value)
  return text.length > MAX_VALUE_CHARS ? `${text.slice(0, MAX_VALUE_CHARS - 1)}…` : text
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}

/**
 * Drain the virtual clock one action per column, calling back before each action runs.
 *
 * This is the only code in the package that touches `scheduler.actions`, `action.execute`, and
 * `scheduler.frame`. They are public today and marked for removal in rxjs v8, so the coupling is
 * named here and pinned by a test: `flush()` is twelve lines, and this is those twelve lines with a
 * seam in them.
 */
export function drainVirtual(
  scheduler: TestScheduler,
  options: { maxFrames: number; maxTicks: number; onTick: (tick: number, frame: number) => void },
): number {
  const { actions } = scheduler
  let tick = 0
  while (tick < options.maxTicks) {
    const action = actions[0]
    if (!action || action.delay > options.maxFrames) break
    actions.shift()
    scheduler.frame = action.delay
    tick += 1
    options.onTick(tick, action.delay)
    const error = action.execute(action.state, action.delay)
    if (error) throw error
  }
  return tick
}

type LaneState = {
  lane: MarbleLane
  /** The event id of the most recent notification, which is what a cause points at. */
  last: string | null
  /** True once the lane has been terminated by the producer, so teardown is not a cancellation. */
  terminated: boolean
  /** Recording stopped: the lane ran past its notification budget. */
  closed: boolean
}

type Recorder = {
  state: { tick: number; current: LaneState | null; origin: string | null; stopping: boolean }
  lanes: LaneState[]
  columns: number[]
  diagnostics: MarbleDiagnostic[]
  create: (id: string, options: { label?: string; parent?: string | null; born?: MarbleBirth | null }) => LaneState
  record: (
    lane: LaneState,
    kind: MarbleLane["notifications"][number]["kind"],
    extra?: { value?: string; note?: string; from?: string },
  ) => void
  deliver: (lane: LaneState, value: unknown, sink: (value: unknown) => void) => void
  /** The lane an inner is being created for, and the event that caused it. */
  cause: () => LaneState | null
}

function createRecorder(format: (value: unknown) => string): Recorder {
  const state: Recorder["state"] = { tick: 0, current: null, origin: null, stopping: false }
  const lanes: LaneState[] = []
  const columns: number[] = [0]
  const diagnostics: MarbleDiagnostic[] = []
  /** How many notifications this document has produced, which is the order of everything in it. */
  let produced = 0

  const create: Recorder["create"] = (id, options) => {
    const parsed = LaneIdSchema.safeParse(id)
    if (!parsed.success) throw new Error(`runMarbleDemo: lane id "${id}" must be [A-Za-z][A-Za-z0-9_-]*`)
    const existing = lanes.find(it => it.lane.id === id)
    if (existing) throw new Error(`runMarbleDemo: lane id "${id}" is declared twice`)
    const lane: MarbleLane = {
      id,
      label: options.label ?? id,
      parent: options.parent ?? null,
      born: options.born ?? null,
      notifications: [],
    }
    const entry: LaneState = { lane, last: null, terminated: false, closed: false }
    lanes.push(entry)
    return entry
  }

  const record: Recorder["record"] = (entry, kind, extra = {}) => {
    if (state.stopping || entry.closed) return
    // The whole-document index, not the lane's: a column's events are ordered by this and by
    // nothing else, because the lanes are separate arrays.
    const seq = produced
    produced += 1
    if (entry.lane.notifications.length >= MAX_LANE_NOTIFICATIONS) {
      entry.closed = true
      entry.lane.notifications.push({
        id: `${entry.lane.id}#${entry.lane.notifications.length + 1}`,
        kind: "truncate",
        tick: state.tick,
        seq,
        note: `recording stopped after ${MAX_LANE_NOTIFICATIONS} notifications — narrow the window`,
      })
      diagnostics.push({
        lane: entry.lane.id,
        code: "overflow",
        message: `lane "${entry.lane.id}" produced more than ${MAX_LANE_NOTIFICATIONS} notifications: narrow the window instead of reading a document this wide`,
      })
      return
    }
    const id = marbleEventId(entry.lane.id, entry.lane.notifications.length)
    entry.lane.notifications.push({
      id,
      kind,
      tick: state.tick,
      seq,
      ...extra,
    })
    entry.last = id
  }

  // Record, then drive the downstream chain with this lane as the current cause: that is what lets
  // a subscription know which event created it, and lets a value know which event produced it.
  const deliver: Recorder["deliver"] = (entry, value, sink) => {
    const inherited = state.origin
    const from = inherited && !inherited.startsWith(`${entry.lane.id}#`) ? inherited : undefined
    record(entry, "next", { value: format(value), ...(from === undefined ? {} : { from }) })
    const previousOrigin = state.origin
    const previousCurrent = state.current
    state.origin = entry.last ?? previousOrigin
    state.current = entry
    try {
      sink(value)
    } finally {
      state.current = previousCurrent
      state.origin = previousOrigin
    }
  }

  return { state, lanes, columns, diagnostics, create, record, deliver, cause: () => state.current }
}

type LaneFactory = {
  lane: (id: string, source: Observable<unknown>, options?: LaneOptions) => Observable<unknown>
  through: (id: string, source: Observable<unknown>, options?: LaneOptions) => Observable<unknown>
  each: (id: string, source: Observable<unknown>, project: InnerProject, options?: EachOptions) => Observable<unknown>
}

export type MarbleLanes = LaneFactory

/** Declare lanes; return nothing. The runner subscribes everything once the callback returns. */
export type MarbleBuild = (lanes: MarbleLanes) => void

/**
 * Run a demo and record what every lane actually did: which causal column each notification landed
 * on, which event caused each subscription, and how each lane ended.
 *
 * Two forms. A plain object of observables records one lane per subscription and cannot see inside
 * a pipe; the build form can, because `each` builds the higher-order operator and records the inner
 * lanes it starts.
 */
export function runMarbleDemo(demo: MarbleDemo, options?: RunMarblesOptions): MarbleRun
export function runMarbleDemo(build: MarbleBuild, options?: RunMarblesOptions): MarbleRun
export function runMarbleDemo(demoOrBuild: MarbleDemo | MarbleBuild, options: RunMarblesOptions = {}): MarbleRun {
  const format = options.format ?? defaultFormat
  const recorder = createRecorder(format)
  const scheduler = new TestScheduler(() => {})
  const subscriptions: Subscription[] = []
  const declared: Array<{ id: string; source: Observable<unknown> }> = []

  const lane = (id: string, source: Observable<unknown>, laneOptions: LaneOptions = {}) => {
    recorder.create(id, {
      label: laneOptions.label ?? options.labels?.[id] ?? id,
      parent: laneOptions.parent ?? options.parents?.[id] ?? null,
    })
    declared.push({ id, source })
    return source
  }

  /** Declare a lane and return the observable, so a higher-order lane can be built from it. */
  const publish = (id: string, observable: Observable<unknown>, laneOptions: LaneOptions = {}) => {
    lane(id, observable, laneOptions)
    return observable
  }

  /**
   * A lane read in the middle of a pipeline. One subscription, recorded once and shared by every
   * lane derived from it, which is what keeps lanes fed by the same source on the same columns.
   * A synchronous source delivers to whichever reader subscribed first, so give it one reader.
   *
   * The lane is read, never declared, so nothing would open its window: `share` opens it on the
   * first reader, and that is the only moment this lane entered a state. Recording it there is what
   * puts a shared source in the document at all, and it lands on the column the lifting chain
   * reached it — after the reader that pulled it in, not before.
   */
  const through = (id: string, source: Observable<unknown>, laneOptions: LaneOptions = {}) => {
    const entry = recorder.create(id, {
      label: laneOptions.label ?? options.labels?.[id] ?? id,
      parent: laneOptions.parent ?? options.parents?.[id] ?? null,
    })
    return new Observable<unknown>(subscriber => {
      recorder.record(entry, "subscribe", { note: "the first reader opened this shared subscription" })
      return source.subscribe({
        next: value => recorder.deliver(entry, value, v => subscriber.next(v)),
        error: error => {
          recorder.record(entry, "error", { value: format(error instanceof Error ? error.message : error) })
          entry.terminated = true
          subscriber.error(error)
        },
        complete: () => {
          recorder.record(entry, "complete")
          entry.terminated = true
          subscriber.complete()
        },
      })
    }).pipe(share())
  }

  /**
   * A higher-order lane: the output lane, plus one lane per inner subscription it starts. The real
   * rxjs operator does the work, so cancellation, concurrency, and accumulation are its own.
   */
  const each = (
    id: string,
    source: Observable<unknown>,
    project: InnerProject,
    eachOptions: EachOptions = {},
  ): Observable<unknown> => {
    const { op = "merge", name = "inner", seed, innerLabel } = eachOptions
    let ordinal = 0

    const innerFor = (value: unknown, index: number, accumulator?: unknown): Observable<unknown> => {
      // The cause is read here, while the operator is deciding to subscribe: for a queued value
      // (concat) that is the moment the value arrived, which is not the moment the inner starts.
      const cause = recorder.cause()
      const from = cause?.last ?? null
      ordinal += 1
      const thisOrdinal = ordinal
      const inner = project(value, index)

      return new Observable<unknown>(subscriber => {
        const entry = recorder.create(`${name}${thisOrdinal}`, {
          label: innerLabel?.(value, thisOrdinal) ?? `${name} #${thisOrdinal}`,
          parent: eachOptions.parent ?? cause?.lane.id ?? id,
          born: {
            tick: recorder.state.tick,
            from,
            cause: format(value),
            ...(accumulator === undefined ? {} : { seed: format(accumulator) }),
          },
        })
        recorder.record(entry, "subscribe")
        const subscription = asObservable(inner).subscribe({
          next: innerValue => recorder.deliver(entry, innerValue, v => subscriber.next(v)),
          error: error => {
            entry.terminated = true
            recorder.record(entry, "error", { value: format(error instanceof Error ? error.message : error) })
            subscriber.error(error)
          },
          complete: () => {
            entry.terminated = true
            recorder.record(entry, "complete")
            subscriber.complete()
          },
        })
        return () => {
          if (!entry.terminated) {
            recorder.record(entry, "unsubscribe", { note: `${op} dropped it before it finished` })
          }
          subscription.unsubscribe()
        }
      })
    }

    const laneOptions: LaneOptions = {
      label: eachOptions.label ?? id,
      ...(eachOptions.parent ? { parent: eachOptions.parent } : {}),
    }
    if (seed !== undefined) {
      const scan = op === "switch" ? switchScan : mergeScan
      const accumulated = source.pipe(
        scan((accumulator: unknown, value: unknown) => innerFor(value, -1, accumulator), seed as unknown),
      )
      return publish(id, accumulated, laneOptions)
    }
    const projectInner = (value: unknown, index: number): Observable<unknown> => innerFor(value, index)
    switch (op) {
      case "merge":
        return publish(id, source.pipe(mergeMap(projectInner)), laneOptions)
      case "switch":
        return publish(id, source.pipe(switchMap(projectInner)), laneOptions)
      case "concat":
        return publish(id, source.pipe(concatMap(projectInner)), laneOptions)
      case "exhaust":
        return publish(id, source.pipe(exhaustMap(projectInner)), laneOptions)
      case "expand":
        return publish(id, source.pipe(expand(projectInner)), laneOptions)
    }
  }

  const lanes: MarbleLanes = { lane, through, each }

  if (typeof demoOrBuild === "function") {
    demoOrBuild(lanes)
  } else {
    for (const id of Object.keys(demoOrBuild)) {
      const source = demoOrBuild[id]
      if (source) lane(id, source)
    }
  }

  // Anything still open when the window closed is cut, not ended: the harness stopped watching, and
  // that is a different fact from an operator cancelling a subscription.
  const cutStillOpen = () => {
    const last = recorder.columns[recorder.columns.length - 1] ?? 0
    const reason = `the window closed at ${last}ms with this lane still running`
    for (const entry of recorder.lanes) {
      const notification = entry.lane.notifications[entry.lane.notifications.length - 1]
      if (
        notification &&
        (notification.kind === "complete" ||
          notification.kind === "error" ||
          notification.kind === "unsubscribe" ||
          notification.kind === "truncate")
      ) {
        continue
      }
      recorder.state.tick = Math.max(recorder.state.tick, notification?.tick ?? recorder.state.tick)
      recorder.record(entry, "truncate", { note: reason })
    }
  }

  scheduler.run(() => {
    for (const { id, source } of declared) {
      const entry = recorder.lanes.find(it => it.lane.id === id)
      if (!entry) continue
      // Before the source, so a synchronous burst lands after the marker that opened the window.
      recorder.record(entry, "subscribe")
      subscriptions.push(
        source.subscribe({
          next: value => recorder.deliver(entry, value, () => {}),
          error: error => {
            entry.terminated = true
            recorder.record(entry, "error", { value: format(error instanceof Error ? error.message : error) })
          },
          complete: () => {
            entry.terminated = true
            recorder.record(entry, "complete")
          },
        }),
      )
    }

    drainVirtual(scheduler, {
      maxFrames: options.windowMs ?? DEFAULT_WINDOW_MS,
      maxTicks: options.maxColumns ?? DEFAULT_MAX_COLUMNS,
      onTick: (tick, frame) => {
        recorder.state.tick = tick
        recorder.columns.push(frame)
      },
    })

    // The cut and the teardown have to happen here, inside the run: `run()` calls its own
    // `flush()` the moment this callback returns, and `flush()` drains with no frame limit. A live
    // `interval` still on the queue at that point is an infinite loop, not a diagram.
    cutStillOpen()
    recorder.state.stopping = true
    for (const subscription of subscriptions) subscription.unsubscribe()
  })

  for (const entry of recorder.lanes) {
    const produced = entry.lane.notifications.some(
      notification => notification.kind === "next" || notification.kind === "error" || notification.kind === "complete",
    )
    if (!produced && !entry.closed) {
      recorder.diagnostics.push({
        lane: entry.lane.id,
        code: "silent",
        message: `lane "${entry.lane.id}" produced nothing inside the window: either it needs a wider window, or its source is not on the virtual clock (a Promise or a real timer is not)`,
      })
    }
  }

  const ordered = options.order
    ? [...recorder.lanes].sort((a, b) => {
        const left = options.order?.indexOf(a.lane.id) ?? -1
        const right = options.order?.indexOf(b.lane.id) ?? -1
        return (left < 0 ? Number.MAX_SAFE_INTEGER : left) - (right < 0 ? Number.MAX_SAFE_INTEGER : right)
      })
    : recorder.lanes

  return {
    doc: normalizeMarbleDoc({
      version: MARBLES_VERSION,
      ...(options.title === undefined ? {} : { title: options.title }),
      columns: recorder.columns,
      lanes: ordered.map(entry => entry.lane),
    }),
    diagnostics: recorder.diagnostics,
  }
}

/** The document, or a throw: mirrors `readMarbles` for the documents a run produced. */
export function readMarbleDemo(run: MarbleRun): MarbleDoc {
  if (run.diagnostics.length > 0) {
    throw new Error(`runMarbleDemo: ${run.diagnostics.map(diagnostic => diagnostic.message).join("; ")}`)
  }
  return run.doc
}

/** `innerFrom`, spelled with the public `from`: an inner may be an observable, an array, or a promise. */
function asObservable(input: ObservableInput<unknown>): Observable<unknown> {
  return isObservable(input) ? input : from(input)
}

function isObservable(value: unknown): value is Observable<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "subscribe" in value &&
    typeof (value as Observable<unknown>).subscribe === "function"
  )
}
