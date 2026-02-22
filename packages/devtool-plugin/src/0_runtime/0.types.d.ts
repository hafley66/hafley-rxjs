/**
 * its all just random scoping at this point. so mark and observe. have all have IDs and then snapshot what ids existed when since everything is ordered start/end
 * we just snapshot things by ids in table of all relations generically lmfao.
 *
 * so entity x has active id of A, y has B, no entity z, so no C, so we snapshot that new entity as being scoped by those relaitons by being in this table. we would
 *
 * decoarate all of observable class tree and catch those events in a buffer somewher on global.
 * use vite plugin to force parsing and bundling rxjs with code manip using ast-grep on matching class expressions and add decorators or proxies inlined
 */

import type { Observable } from "rxjs/internal/Observable"
import type { Subscription } from "rxjs/internal/Subscription"

type Prettify<T> = { [K in keyof T]: T[K] } & NonNullable<unknown>

export type ObservableEvent =
  | { type: "enable" | "disable" | "reset" }
  | (
      | { type: "fun"; id: string; fn: WeakRef<Function>; fn_source: string }
      | { type: "fun-call"; id: string; args: Improved["arg2"][] }
      | { type: "fun-call-return"; id: string; $return: Improved["arg2"] }
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

// Bootstrap the late-bound emitter - must run synchronously so user module code
// that calls _rxjs_debugger_module_start gets proper isEnabled state
console.log("Bootstrapping")
// bootstrap(
//   _observableEvents$,
//   () => isEnabled$.value,
//   () => state$.value.stack.hmr_track,
//   () => state$.value.store,
//   () => state$.value.stack,
// )

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
    fn_ref?: Function // live fn ref for HMR swap
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
  fun: {
    fn: WeakRef<Function>
    fn_source: string
  }
  call: {}
  arg2: {
    call_id: string
    value?: any
    obs_id?: string
    fun_id?: string
  }
}

type Improved = {
  [K in keyof Hmm]: Prettify<
    Hmm[K] & { id: string; created_at: number; name?: string; created_at_end?: number; tags?: string[] }
  >
}

export type State = {
  isEnabled: boolean
  stack: { [K in keyof Improved]: Improved[K][] }
  store: { [K in keyof Improved]: Record<string, Improved[K]> }
}

export type ObservableRef = {
  observable_id: string
  path: string // lodash-style: "args.0.delay.$return"
}
