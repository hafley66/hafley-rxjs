/**
 * its all just random scoping at this point. so mark and observe. have all have IDs and then snapshot what ids existed when since everything is ordered start/end
 * we just snapshot things by ids in table of all relations generically lmfao.
 *
 * so entity x has active id of A, y has B, no entity z, so no C, so we snapshot that new entity as being scoped by those relaitons by being in this table. we would
 *
 * decoarate all of observable class tree and catch those events in a buffer somewher on global.
 * use vite plugin to force parsing and bundling rxjs with code manip using ast-grep on matching class expressions and add decorators or proxies inlined
 */

import { useEffect, useState } from "react"
import { BehaviorSubject } from "rxjs/internal/BehaviorSubject"
import { Observable } from "rxjs/internal/Observable"
import { Subject } from "rxjs/internal/Subject"
import { type Subscription } from "rxjs/internal/Subscription"
import { filter, scan, startWith } from "rxjs/operators"
import { bootstrap } from "./01.patch-observable"

// Separate untracked isEnabled state for tracking control
export const isEnabled$ = new BehaviorSubject(false)

// Marker to identify tracked observable wrappers (for HMR)
export const TRACKED_MARKER = Symbol("rxjs-debugger-tracked")

// Flag to suppress send events (for trackedObservable internal subscriptions)
export const suppressSend$ = new BehaviorSubject(false)

// Debug buffer for capturing all events (reset in test setup)
export const _eventBuffer: ObservableEvent[] = []
export function resetEventBuffer() {
  _eventBuffer.length = 0
}

/** Temporarily disable tracking for internal operations */
export function __withNoTrack<T>(fn: () => T): T {
  const prev = isEnabled$.value
  isEnabled$.next(false)
  try {
    return fn()
  } finally {
    isEnabled$.next(prev)
  }
}

/** Temporarily suppress send events while keeping track events enabled */
export function __withNoSend<T>(fn: () => T): T {
  const prev = suppressSend$.value
  suppressSend$.next(true)
  try {
    return fn()
  } finally {
    suppressSend$.next(prev)
  }
}

type Prettify<T> = { [K in keyof T]: T[K] } & NonNullable<unknown>

export type ObservableRef = {
  observable_id: string
  path: string // lodash-style: "args.0.delay.$return"
}

export type ObservableEvent =
  | (
      | { type: "operator-fun-call"; id: string; name: string; args: any[] }
      | { type: "operator-fun-call-return"; id: string }
      | { type: "operator-call"; id: string; operator_fun_id: string; source_observable_id: string; index: number }
      | { type: "operator-call-return"; id: string; target_observable_id: string }
      | { type: "arg-call"; id: string; arg_id: string; args: any[] }
      | { type: "arg-call-return"; id: string; observable_id?: string; subscription_id?: string }
    )
  | { type: "constructor-call-return"; id: string; observable: Observable<any>; source: string }
  | { type: "factory-call-return"; observable: Observable<any>; args: any[]; name: string }
  | ({ observable_id: string; id: string } & (
      | { type: "pipe-get" }
      | { type: "pipe-call"; args: any[]; index: number }
      | { type: "pipe-call-return" }
      | { type: "subscribe-call"; args: any[]; index: number }
      | { type: "subscribe-call-return"; subscription: Subscription }
      | ({ type: "send-call"; subscription_id: string } & (
          | { kind: "next"; value: any; index: number }
          | { kind: "error"; error: Error }
          | { kind: "complete" }
        ))
      | { type: "send-call-return" }
      | { type: "unsubscribe-call"; args: any[]; index: number }
      | { type: "unsubscribe-call-return" }
    ))
  // HMR track events - id is surrogate, key is location string
  | { type: "track-call"; id: string; key: string }
  | { type: "track-call-return"; id: string; mutable_observable_id?: string; stable_observable_id?: string }
  // HMR module events
  | { type: "hmr-module-call"; id: string; url: string }
  | { type: "hmr-module-call-return"; id: string }

export const _observableEvents$ = new Subject<ObservableEvent>()

// Capture all events to debug buffer (useful for test debugging)
_observableEvents$.subscribe(e => _eventBuffer.push(e))

// Bootstrap the late-bound emitter - must run synchronously so user module code
// that calls _rxjs_debugger_module_start gets proper isEnabled state
bootstrap(
  _observableEvents$,
  () => isEnabled$.value,
  () => state$.value.stack.hmr_track,
  () => state$.value.store,
  () => state$.value.stack,
)

type Hmm = {
  // Unified observable entity (collapse Subject/BehaviorSubject/creation ops)
  observable: {
    obs_ref?: WeakRef<Observable<any>> // live ref for id → observable lookup
  }
  // Operator factory call with bound args
  operator_fun: {}
  // Operator usage in pipe (references operator_fun)
  operator: {
    operator_fun_id: string
    pipe_id: string
    index: number // position in pipe chain
    source_observable_id: string
    target_observable_id: string
  }
  // Pipe call
  pipe: {
    parent_observable_id: string
    observable_id: string // final output
  }
  // Subscription (dual timespan: call-time scope AND async lifespan)
  subscription: {
    unsubscribed_at?: number // unsubscribe-call timestamp
    unsubscribed_at_end?: number // unsubscribe-call-return timestamp
    observable_id: string
    parent_subscription_id?: string
    is_sync: boolean
    module_id?: string // FK → hmr_module (which file created this sub)
    sub_ref?: WeakRef<Subscription> // live ref for HMR cleanup
  }
  // Arg position (static observable refs + function positions + primitives)
  arg: {
    path: string // "args.0.delay" or "args.0.0"
    observable_id?: string // if static obs ref
    owner_id: string // generic - check stores dynamically
    is_function: boolean
    value?: unknown // for primitives (number, string, boolean, null)
    fn_source?: string // function source code (dev mode only)
    fn_ref?: WeakRef<Function> // live fn ref for HMR swap
  }
  // Arg function execution (dynamic observable creation)
  arg_call: {
    arg_id: string
    observable_id?: string // the observable returned
    subscription_id?: string // which subscription triggered this
    input_values?: any[]
  }
  // Emission (NOT implementing yet - focus on structure first)
  send: {
    observable_id: string
    subscription_id: string
    type: "next" | "error" | "complete"
    value?: any
  }
  // HMR track - separate layer for hot module replacement
  hmr_track: {
    key: string // track location key from __$ (e.g., "outer", "root:child")
    mutable_observable_id: string // FK → current inner observable (MUTABLE on HMR)
    stable_observable_id?: string // FK → stable wrapper observable
    parent_track_id?: string // tree structure for nesting
    index: number // position in parent scope
    version: number // bumps on HMR
    prev_observable_ids: string[] // orphaned observables, awaiting GC
    module_id?: string // FK → hmr_module (which file owns this track)
    module_version?: number // set on track-call-return, for orphan detection
  }
  // HMR module - tracks file-level module lifecycle
  hmr_module: {
    url: string // import.meta.url
    version: number // bumps on each HMR reload
    prev_keys: string[] // track keys from previous version (for orphan detection)
  }
}

type Improved = {
  [K in keyof Hmm]: Prettify<
    Hmm[K] & { id: string; created_at: number; name?: string; created_at_end?: number; tags?: string[] }
  >
}

export type State = {
  owner_id: string
  stack: { [K in keyof Improved]: Improved[K][] }
  store: { [K in keyof Improved]: Record<string, Improved[K]> }
  rel: ({ [K in keyof Improved as `${K}_id`]: string } & { owner_id: string })[]
}

export function scanEager<Event, State>(acc: (sum: State, next: Event) => State, defaultValue: State) {
  return (source$: Observable<Event>) => source$.pipe(scan(acc, defaultValue), startWith(defaultValue))
}

class EasierBS<T extends {}> extends BehaviorSubject<T> {
  private _initialValue: T

  constructor(initialValue: T) {
    super(initialValue)
    this._initialValue = initialValue
  }

  set(partial: Partial<T>) {
    return this.next({
      ...this.value,
      ...partial,
    })
  }

  reset() {
    return this.next(structuredClone(this._initialValue))
  }

  scanEager<Next>(accumulator: (sum: T, next: Next) => T) {
    return (source$: Observable<Next>) => {
      return source$.pipe(scanEager((_sum, next) => accumulator(this.value, next), this.value))
    }
  }

  use$(): T {
    const [, forceUpdate] = useState(0)

    useEffect(() => {
      const sub = this.subscribe(() => forceUpdate(n => n + 1))
      return () => sub.unsubscribe()
    }, [])

    return this.value
  }
}

export const state$ = new EasierBS<State>({
  owner_id: "",
  rel: [],
  stack: {
    observable: [],
    operator_fun: [],
    operator: [],
    pipe: [],
    subscription: [],
    arg: [],
    arg_call: [],
    send: [],
    hmr_track: [],
    hmr_module: [],
  },
  store: {
    observable: {},
    operator_fun: {},
    operator: {},
    pipe: {},
    subscription: {},
    arg: {},
    arg_call: {},
    send: {},
    hmr_track: {},
    hmr_module: {},
  },
})

export const observableEventsEnabled$ = _observableEvents$.pipe(filter(() => isEnabled$.value))

type EntityKey = keyof Improved

export function leftJoin<
  L extends EntityKey,
  R extends EntityKey,
  LKey extends keyof Improved[L] & string,
  RKey extends keyof Improved[R] & string,
>(
  left: { table: L; key: LKey },
  right: { table: R; key: RKey },
  state: State = state$.value,
): (Improved[L] & { [K in R]?: Improved[R] })[] {
  const leftRecords = Object.values(state.store[left.table]) as Improved[L][]
  const rightStore = state.store[right.table] as Record<string, Improved[R]>

  const rightIndex = new Map<unknown, Improved[R]>()
  for (const record of Object.values(rightStore)) {
    rightIndex.set(record[right.key as keyof Improved[R]], record)
  }

  return leftRecords.map(leftRow => {
    const leftVal = leftRow[left.key as keyof Improved[L]]
    const rightRow = rightIndex.get(leftVal)
    return {
      ...leftRow,
      [right.table]: rightRow,
    } as Improved[L] & { [K in R]?: Improved[R] }
  })
}
