import { set } from "lodash"
import { type Observable, scan } from "rxjs"
import { DietBehaviorSubject, DietSubject, dietShareRefCount, EasierDietBS } from "../../lib/2_diet_rxjs"
import type { ObservableEvent, State } from "./0.types"
// noRxjs()
export class RxJSTracker {
  // Marker to identify tracked observable wrappers (for HMR)
  static TRACKED_MARKER = Symbol("rxjs-debugger-tracked")

  // Events that don't require track context at emit time
  // - track-*: manage context itself
  // - send-*: runtime events, filtered in accumulator
  // - subscribe-*: runtime events, gated by store check in patchedSubscribe
  // - unsubscribe-*: runtime events
  // - hmr-module-*: manage module context itself
  static UNTRACKED_EVENTS = new Set([
    "reset",
    "enable",
    "disable",
    "track-call",
    "track-call-return",
    "track-update",
    "send-call",
    "send-call-return",
    "subscribe-call",
    "subscribe-call-return",
    "unsubscribe-call",
    "unsubscribe-call-return",
    "hmr-module-call",
    "hmr-module-call-return",
  ])

  // Marker to identify patched subscriptions (avoid double-patching)
  static PATCHED_UNSUB = Symbol("rxjs-debugger-patched-unsubscribe")

  // Flag to suppress send events (for trackedObservable internal subscriptions
  suppressSend$ = new DietBehaviorSubject(false)

  _idCounter = 1
  createId = (): string => {
    // const err = new Error()
    console.log("Creating? ", this._idCounter)
    if (this._idCounter === 35) {
      console.log(new Error().stack)
    }
    return String(this._idCounter++)
  }

  resetIdCounter = () => {
    this._idCounter = 1
  }
  _mockNow: number | null = null
  now(): number {
    return this._mockNow ?? performance.now()
  }
  setNow(time: number | null) {
    this._mockNow = time
  }

  // Tag context - set by decorators for tagging observables/operators
  tagContext: string[] = []

  state$ = new EasierDietBS<State>({
    isEnabled: false,
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

  event$ = new DietSubject<ObservableEvent>()
  events$ = new EasierDietBS<ObservableEvent[]>([])

  events$$ = this.event$
    .pipe(
      this.events$.scanEager((a, b) => a.concat(b)),
      dietShareRefCount(),
    )
    .subscribe()

  shouldEmit = (eventType: string): boolean => {
    // Untracked events always emit (regardless of enabled state)
    // This allows track-call/track-call-return during defer factory execution
    // where tracking is disabled to prevent subscribe-call cascades
    if (RxJSTracker.UNTRACKED_EVENTS.has(eventType)) {
      return true
    }
    const enabled = this.state$.value.isEnabled
    if (!enabled) {
      console.log("Dropping: !enabled", eventType)
      return false
    }
    // Structured events require track context
    const trackStack = this.state$.value.stack.hmr_track
    if (trackStack.length > 0) {
      return true
    } else {
      console.log("Dropping: !noTrack", eventType)
      return false
    }
  }
  emit = (event: ObservableEvent) => {
    if (!this.shouldEmit(event.type)) {
      return
    }
    this.event$.next(event)
  }

  state$$ = this.event$.pipe(
    this.state$.scanEager((state, event) => {
      switch (event.type) {
        case "enable":
        case "disable": {
          state.isEnabled = event.type === "enable"
          break
        }
        case "constructor-call-return": {
          state.store.observable[event.id] = {
            id: event.id,
            created_at: this.now(),
            created_at_end: this.now(),
            name: `new ${event.observable.constructor.name}`,
            obs_ref: new WeakRef(event.observable),
          }
          break
        }

        case "factory-call-return": {
          const obsId = getObsId(event.observable) ?? "unknown"
          if (state.store.observable[obsId]) {
            // Serialize args into name for structural hash
            const argsStr = serializeArgs(event.args)
            state.store.observable[obsId].name = `${event.name}(${argsStr})`
          }
          const args = this._0_crawlArgs(event.args, obsId)
          for (const arg of args) {
            state.store.arg[arg.id] = arg
            arg.observable_id = obsId
          }
          break
        }

        case "pipe-get": {
          state.stack.pipe.push({
            id: event.id,
            created_at: this.now(),
            parent_observable_id: event.observable_id,
            observable_id: "", // Will be set on pipe-call-return
          })
          state.store.pipe[event.id] = state.stack.pipe[state.stack.pipe.length - 1]!

          break
        }

        case "pipe-call": {
          const pipeEntity = state.stack.pipe[state.stack.pipe.length - 1]
          if (pipeEntity) {
          }
          break
        }

        case "pipe-call-return": {
          const entity = state.stack.pipe.pop()
          if (!entity) break
          entity.created_at_end = this.now()
          entity.observable_id = event.observable_id
          break
        }

        case "subscribe-call": {
          /**
           * ┌─────────────────────────────────────────────────────────────────────┐
           * │ INTERNAL PLUMBING DETECTION                                         │
           * ├─────────────────────────────────────────────────────────────────────┤
           * │ When a tracked wrapper subscribes to its own inner observable,      │
           * │ that's internal plumbing - not a user subscription.                 │
           * │                                                                     │
           * │   hmr_track[key] {                                                  │
           * │     stable_observable_id: "3"  ← wrapper                            │
           * │     mutable_observable_id: "2" ← inner                              │
           * │   }                                                                 │
           * │                                                                     │
           * │   subscription from "3" → "2" = internal (skip tracking)            │
           * │   subscription from user → "3" = external (track it)                │
           * │                                                                     │
           * │ The relationship is encoded in the data model - we just query it.   │
           * └─────────────────────────────────────────────────────────────────────┘
           */
          const parentSub = state.stack.subscription.at(-1)
          if (parentSub) {
            const isInternalPlumbing = Object.values(state.store.hmr_track).some(
              t =>
                t.stable_observable_id === parentSub.observable_id && t.mutable_observable_id === event.observable_id,
            )
            if (isInternalPlumbing) break // Skip tracking wrapper→inner subscription
          }

          const currentModule = state.stack.hmr_module.at(-1)
          state.store.subscription[event.id] = {
            id: event.id,
            created_at: this.now(),
            observable_id: event.observable_id,
            parent_subscription_id: parentSub?.id,
            is_sync: false, // Will be updated if complete/error fires before subscribe-call-return
            module_id: currentModule?.id,
          }
          state.stack.subscription.push(state.store.subscription[event.id]!)
          break
        }

        case "subscribe-call-return": {
          // If subscription wasn't tracked (internal plumbing), skip
          if (!state.store.subscription[event.id]) break

          const subEntity = state.stack.subscription.pop()
          if (subEntity) {
            subEntity.created_at_end = this.now()
            subEntity.sub_ref = new WeakRef(event.subscription)
            // TODO: Check is_sync flag (did complete/error fire before this?)
          }
          break
        }

        case "unsubscribe-call": {
          const subEntity = state.store.subscription[event.id]
          if (subEntity) {
            subEntity.unsubscribed_at = this.now()
          }
          break
        }

        case "unsubscribe-call-return": {
          const entity = state.store.subscription[event.id]
          if (entity) {
            entity.unsubscribed_at_end = this.now()
          }
          break
        }

        case "send-call": {
          // Find origin track for this observable - skip if none (internal subscription)
          // Check mutable_observable_id (inner) and stable_observable_id (wrapper)
          const originTrack = Object.values(state.store.hmr_track).find(
            t => t.mutable_observable_id === event.observable_id || t.stable_observable_id === event.observable_id,
          )
          if (!originTrack) break

          // Push origin track context so inner observables get proper context
          state.stack.hmr_track.push(originTrack)

          // Keep actual observable_id - don't overwrite to track.id
          state.store.send[event.id] = {
            created_at: this.now(),
            id: event.id,
            observable_id: event.observable_id,
            subscription_id: event.subscription_id,
            type: event.kind,
            ...(event.kind === "next" ? { value: event.value } : event.kind === "error" ? { error: event.error } : {}),
          }
          state.stack.send.push(state.store.send[event.id]!)
          break
        }

        case "send-call-return": {
          // Only process if send-call recorded this (had origin track)
          const sendEntity = state.store.send[event.id]
          if (!sendEntity) break

          state.stack.send.pop()
          sendEntity.created_at_end = this.now()
          state.stack.hmr_track.pop()
          // Pop parent subscription if we pushed one during arg-call
          if ((sendEntity as any)._pushedParentSub) {
            state.stack.subscription.pop()
            delete (sendEntity as any)._pushedParentSub
          }
          break
        }

        case "operator-fun-call": {
          const argsStr = serializeArgs(event.args)
          state.store.operator_fun[event.id] = {
            created_at: this.now(),
            id: event.id,
            name: `${event.name}(${argsStr})`,
          }
          state.stack.operator_fun.push(state.store.operator_fun[event.id]!)
          // Crawl args to find and wrap functions (delay, project, etc.)
          const args = this._0_crawlArgs(event.args, event.id)
          for (const arg of args) {
            state.store.arg[arg.id] = arg
          }
          // Don't capture operator_fun into track - only observables matter
          break
        }
        case "operator-fun-call-return": {
          const val = state.stack.operator_fun.pop()
          if (!val) break
          val.created_at_end = this.now()
          break
        }
        case "operator-call": {
          state.store.operator[event.id] = {
            created_at: this.now(),
            id: event.id,
            operator_fun_id: event.operator_fun_id,
            source_observable_id: event.source_observable_id,
            target_observable_id: "",
            pipe_id: state.stack.pipe[state.stack.pipe.length - 1]?.id ?? "UNKNOWN",
            index: event.index,
          }
          state.stack.operator.push(state.store.operator[event.id]!)
          break
        }
        case "operator-call-return": {
          const val = state.stack.operator.pop()
          if (!val) break
          val.created_at_end = this.now()
          val.target_observable_id = event.target_observable_id
          // Chain observable names: target.name = source.name + "." + opFun.name
          const sourceObs = state.store.observable[val.source_observable_id]
          const targetObs = state.store.observable[val.target_observable_id]
          const opFun = state.store.operator_fun[val.operator_fun_id]
          if (targetObs && opFun) {
            targetObs.name = `${sourceObs?.name ?? "?"}.${opFun.name}`
          }
          break
        }

        case "arg-call": {
          // Get the current subscription from the send stack
          const currentSendSub = state.stack.send[state.stack.send.length - 1]?.subscription_id
          const currentSub = currentSendSub ? state.store.subscription[currentSendSub] : undefined

          // For higher-order operators, push the parent subscription onto the stack
          // so inner observables get the correct parent (stays until send-call-return)
          if (currentSub?.parent_subscription_id) {
            const parentSub = state.store.subscription[currentSub.parent_subscription_id]
            if (parentSub) {
              state.stack.subscription.push(parentSub)
              // Track on the send so we know to pop in send-call-return
              const currentSend = state.stack.send[state.stack.send.length - 1]
              if (currentSend) {
                ;(currentSend as any)._pushedParentSub = true
              }
            }
          }

          const entity = {
            arg_id: event.arg_id,
            created_at: this.now(),
            id: event.id,
            input_values: event.args,
            subscription_id: state.stack.subscription[state.stack.subscription.length - 1]?.id ?? "unknown",
          }
          state.stack.arg_call.push(entity)
          break
        }
        case "arg-call-return": {
          const val = state.stack.arg_call.pop()
          if (!val) break

          // Only store if it returned an observable
          if (event.observable_id && event.observable_id !== "UNKNOWN") {
            val.created_at_end = this.now()
            val.observable_id = event.observable_id
            state.store.arg_call[val.id] = val
          }
          break
        }
        case "track-call": {
          const parent = state.stack.hmr_track.at(-1)
          const currentModule = state.stack.hmr_module.at(-1)
          // Runtime provides surrogate id, key is the location string
          const entity = {
            id: event.id,
            key: event.key,
            created_at: this.now(),
            mutable_observable_id: "",
            parent_track_id: parent?.id,
            index: 0, // TODO: track per-parent index
            version: 0,
            prev_observable_ids: [] as string[],
            module_id: currentModule?.id,
          }
          state.stack.hmr_track.push(entity)
          break
        }
        case "track-call-return": {
          const entity = state.stack.hmr_track.pop()
          if (!entity) break
          // IDs come from event (runtime knows them), not inferred from stack
          if (!event.mutable_observable_id) break
          entity.mutable_observable_id = event.mutable_observable_id
          entity.stable_observable_id = event.stable_observable_id
          entity.created_at_end = this.now()

          const currentModule = state.stack.hmr_module.at(-1)
          // Lookup by id - O(1). Runtime reuses existing track's id on HMR re-execution.
          const existing = state.store.hmr_track[entity.id]
          if (existing && existing.mutable_observable_id !== event.mutable_observable_id) {
            // HMR re-execution detected - compare structural hashes
            const oldObs = state.store.observable[existing.mutable_observable_id]
            const newObs = state.store.observable[event.mutable_observable_id]
            const structureChanged = oldObs?.name !== newObs?.name

            // Update in place
            existing.prev_observable_ids.push(existing.mutable_observable_id)
            existing.mutable_observable_id = event.mutable_observable_id
            existing.stable_observable_id = event.stable_observable_id
            existing.version += 1
            existing.module_version = currentModule?.version
            // Store whether this was a structural change (for future optimization)
            // structureChanged: true = need full swap, false = fn-only hot swap
            ;(existing as any).last_change_structural = structureChanged
          } else if (existing) {
            // Same mutable_observable_id, just mark as touched this module version
            existing.module_version = currentModule?.version
            // Update stable_observable_id if changed
            if (event.stable_observable_id) {
              existing.stable_observable_id = event.stable_observable_id
            }
          } else {
            // First time - store by surrogate id
            entity.module_version = currentModule?.version
            state.store.hmr_track[entity.id] = entity
          }
          break
        }

        case "hmr-module-call": {
          const existing = state.store.hmr_module[event.id]
          if (existing) {
            // HMR reload - bump version, snapshot current keys
            const currentKeys = Object.values(state.store.hmr_track)
              .filter(t => t.module_id === event.id)
              .map(t => t.key)
            existing.prev_keys = currentKeys
            existing.version += 1
          } else {
            // First load
            state.store.hmr_module[event.id] = {
              id: event.id,
              created_at: this.now(),
              url: event.url,
              version: 1,
              prev_keys: [],
            }
          }
          state.stack.hmr_module.push(state.store.hmr_module[event.id]!)
          break
        }

        case "hmr-module-call-return": {
          const module = state.stack.hmr_module.pop()
          if (!module) {
            console.log("NO MODULE FOUND? WHY ARE YOU HERE LOL")
            break
          }
          module.created_at_end = this.now()

          // Diff: which keys from prev_keys weren't touched this module version?
          const currentKeys = new Set(
            Object.values(state.store.hmr_track)
              .filter(t => t.module_id === module.id && t.module_version === module.version)
              .map(t => t.key),
          )
          const orphanedKeys = module.prev_keys.filter(k => !currentKeys.has(k))

          // Clean up orphaned tracks: collect stable IDs, complete wrapper, delete from store
          const orphanedStableIds = new Set<string>()
          for (const key of orphanedKeys) {
            // Find track by key (store is keyed by surrogate id)
            const track = Object.values(state.store.hmr_track).find(t => t.key === key)
            if (track) {
              if (track.stable_observable_id) {
                orphanedStableIds.add(track.stable_observable_id)
              }
              // Complete the wrapper to trigger teardown (unsubscribes state$$ watcher)
              // Use observable table (obs_ref is single source of truth for WeakRefs)
              const stableId = track.stable_observable_id
              const wrapper = stableId ? state.store.observable[stableId]?.obs_ref?.deref() : undefined
              if ("complete" in (wrapper as any) && typeof (wrapper as any).complete === "function") {
                ;(wrapper as any).complete()
              }
              // Remove from store by id
              delete state.store.hmr_track[track.id]
            }
          }

          // Unsubscribe any subscription to an orphaned stable observable
          for (const sub of Object.values(state.store.subscription)) {
            if (orphanedStableIds.has(sub.observable_id) && !sub.unsubscribed_at) {
              sub.sub_ref?.deref()?.unsubscribe()
              sub.unsubscribed_at = this.now()
              sub.unsubscribed_at_end = this.now()
            }
          }

          // Clear prev_keys since we've processed the diff
          module.prev_keys = []
          break
        }
      }
      return state
    }),
    dietShareRefCount(),
  )

  _0_crawlArgs = (rawArgs: any[], ownerId: string): ArgEntity[] => {
    const args: ArgEntity[] = []
    for (let i = 0; i < rawArgs.length; i++) {
      const foundArgs = this._1_findArgs(rawArgs[i], `$args.${i}`, 0, { $args: rawArgs })
      for (const arg of foundArgs) {
        arg.owner_id = ownerId
      }
      args.push(...foundArgs)
    }
    return args
  }

  _1_findArgs(value: unknown, path = "$args", depth = 0, rootVal: any): ArgEntity[] {
    if (depth > MAX_DEPTH) return []

    const args: ArgEntity[] = []

    // Function - create arg entity with is_function: true
    if (isFunction(value)) {
      const arg_id = this.createId()
      const fn_ref = new WeakRef(value)
      args.push({
        id: arg_id,
        created_at: this.now(),
        path,
        is_function: true,
        owner_id: "", // Set by caller
        fn_source: value.toString(),
        fn_ref,
      })
      set(rootVal, path, (...callArgs: any[]) => {
        const id = this.createId()
        this.emit({
          type: "arg-call",
          id,
          arg_id,
          args: callArgs,
        })
        // Look up fn_ref from state$ at call time so HMR can swap it
        const fn = this.state$.value.store.arg[arg_id]?.fn_ref?.deref()
        const out = fn ? fn(...callArgs) : undefined
        this.emit({
          type: "arg-call-return",
          id,
          observable_id: getObsId(out) ?? "UNKNOWN",
        })
        return out
      })
      return args
    }

    // Observable - create arg entity with observable_id
    if (getObsId(value) != null) {
      const observable_id = getObsId(value)
      if (observable_id) {
        args.push({
          id: this.createId(),
          created_at: this.now(),
          path,
          observable_id,
          is_function: false,
          owner_id: "", // Set by caller
        })
      }
      return args
    }

    // Array
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        args.push(...this._1_findArgs(value[i], `${path}.${i}`, depth + 1, rootVal))
      }
      return args
    }

    // Object
    if (isObject(value)) {
      for (const [key, val] of Object.entries(value)) {
        args.push(...this._1_findArgs(val, `${path}.${key}`, depth + 1, rootVal))
      }
      return args
    }

    // Primitive (number, string, boolean, null, undefined)
    if (value !== undefined) {
      args.push({
        id: this.createId(),
        created_at: this.now(),
        path,
        is_function: false,
        owner_id: "", // Set by caller
        value,
      })
    }

    return args
  }

  reset = () => {
    this.resetIdCounter()
    this.state$.reset()
    this.events$.reset()
  }
}

export const main = new RxJSTracker()

/** Temporarily disable tracking for internal operations */
export function __withNoTrack<T>(fn: () => T): T {
  console.log("__withNoTrack", fn.toString())
  const prev = main.state$.value.isEnabled
  main.emit({ type: "disable" })
  try {
    return fn()
  } finally {
    main.emit({ type: prev ? "enable" : "disable" })
    console.log("__withNoTrack-Finally")
  }
}

// /** Temporarily suppress send events while keeping track events enabled */
// export function __withNoSend<T>(fn: () => T): T {
//   const prev = main.suppressSend$.value
//   main.suppressSend$.next(true)
//   try {
//     return fn()
//   } finally {
//     main.suppressSend$.next(prev)
//   }
// }

export const getObsId = (it: any): string => {
  return it?.__oid__ ?? ""
}
export const setObsId = (it: any, id: string) => {
  if (it && typeof it === "object") it.__oid__ === id
}

// Its a parser plugin thing not a runtime thing. Useful for tests.
export const autoTrackFile = () => {}

// Its a parser plugin thing not a runtime thing. Useful for tests.
export const noAutoTrackFile = () => {}

// Structural serialization for HMR change detection
function isObservable(val: any): val is Observable<any> {
  return val && typeof val === "object" && typeof val.subscribe === "function"
}

function serializeValue(val: any): string {
  if (typeof val === "function") return "fn"
  if (isObservable(val)) {
    const id = getObsId(val)
    return id ? `$ref[${id}]` : "$ref[?]"
  }
  if (Array.isArray(val)) return `[${val.map(serializeValue).join(",")}]`
  if (val && typeof val === "object") {
    const entries = Object.entries(val)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${serializeValue(v)}`)
    return `{${entries.join(",")}}`
  }
  if (typeof val === "string") return `"${val}"`
  if (val === null) return "null"
  if (val === undefined) return "undefined"
  return String(val)
}

function serializeArgs(args: any[]): string {
  return args.map(serializeValue).join(",")
}

const MAX_DEPTH = 10

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object"
}

function isFunction(value: unknown): value is Function {
  return typeof value === "function"
}

type ArgEntity = State["store"]["arg"][string]

// Marker to identify patched subscriptions (avoid double-patching)

const noop = () => {}

/** Normalize subscribe args into { next, error, complete } - always returns functions (noop if not provided) */
function normalizeObserver(args: any[]): { next: (v: any) => void; error: (e: any) => void; complete: () => void } {
  if (args.length === 0) {
    return { next: noop, error: noop, complete: noop }
  }
  const first = args[0]
  if (first && typeof first === "object") {
    // Observer object signature
    return {
      next: typeof first.next === "function" ? first.next.bind(first) : noop,
      error: typeof first.error === "function" ? first.error.bind(first) : noop,
      complete: typeof first.complete === "function" ? first.complete.bind(first) : noop,
    }
  }
  // Function signature: (next?, error?, complete?)
  return {
    next: typeof args[0] === "function" ? args[0] : noop,
    error: typeof args[1] === "function" ? args[1] : noop,
    complete: typeof args[2] === "function" ? args[2] : noop,
  }
}
// Marker to prevent double-patching the same prototype
const PATCHED_PROTO = Symbol("rxjs-debugger-patched-prototype")

/**
 * Patches Observable.prototype with tracking for pipe/subscribe.
 * Must be called with the Observable class after it's defined.
 * Safe to call multiple times - will skip if already patched.
 */
export function patchObservable(Observable: { prototype: any; create?: any }) {
  const proto = Observable.prototype

  // Skip if already patched
  if (proto[PATCHED_PROTO]) return
  proto[PATCHED_PROTO] = true

  // Set global flag for debugging
  if (typeof globalThis !== "undefined") {
    ;(globalThis as any).__rxjs_debugger_patched__ = true
    console.log("[rxjs-debugger] Observable.prototype patched")
  }

  // TODO: lift creates lots of intermediate observables - may need to re-enable if noisy
  // const originalLift = proto.lift
  // proto.lift = function liftNoTrack(operator: any) {
  //   if (_getIsEnabled) {
  //     const original = _getIsEnabled
  //     _getIsEnabled = () => false
  //     const result = originalLift.call(this, operator)
  //     _getIsEnabled = original
  //     return result
  //   }
  //   return originalLift.call(this, operator)
  // }

  // Override static create to skip tracking - deprecated but still used internally
  if (Observable.create) {
    const originalCreate = Observable.create
    Observable.create = function createNoTrack(subscribe: any) {
      const result = __withNoTrack(() => originalCreate(subscribe))
      return result
    }
  }

  // Patch pipe
  const originalPipe = proto.pipe
  Object.defineProperty(proto, "pipe", {
    get() {
      const observable_id = getObsId(this)
      if (!observable_id) return originalPipe.bind(this)
      const id = main.createId()
      main.emit({ type: "pipe-get", id, observable_id })
      return function patchedPipe(this: Observable<any>, ...args: any[]) {
        const ind = 0
        main.emit({ observable_id, type: "pipe-call", args, id, index: ind })

        const decoratedOps = args.map((op, opIndex) => {
          return (source: any) => {
            const opId = main.createId()
            main.emit({
              type: "operator-call",
              id: opId,
              operator_fun_id: op?.operator_fun_id ?? "UNKNOWN",
              source_observable_id: getObsId(source) ?? "UNKNOWN",
              index: opIndex,
            })
            const out = op(source)
            main.emit({
              type: "operator-call-return",
              id: opId,
              target_observable_id: getObsId(out) ?? "UNKNOWN",
            })
            return out
          }
        })

        const out = originalPipe.apply(this, decoratedOps as any)
        main.emit({
          observable_id: getObsId(out) ?? "UNKNOWN",
          type: "pipe-call-return",
          id,
        })
        return out
      }
    },
  })

  const originalSubscribe = proto.subscribe
  // console.log("patching subscribe")
  proto.subscribe = function patchedSubscribe(...args: any[]) {
    // console.log("GRRRRR")

    const obs_id = getObsId(this)
    const store = main.state$.value.store
    if (!obs_id || !store?.observable[obs_id]) {
      console.log("oops")
      const sub = originalSubscribe.apply(this, args as any)
      ;(sub as any).__id__ = ""
      return sub
    }

    const observable_id = obs_id
    const subscription_id = main.createId()
    // console.log("So it should work?")
    main.emit({ observable_id, type: "subscribe-call", args, id: subscription_id, index: 0 })

    const observer = normalizeObserver(args)
    let nextIndex = 0

    // Callbacks emit send events with subscription_id
    // Accumulator handles stack push/pop based on these events
    const wrappedObserver = {
      next: (value: any) => {
        const emitId = main.createId()
        main.emit({
          subscription_id,
          type: "send-call",
          id: emitId,
          observable_id,
          kind: "next",
          value,
          index: nextIndex++,
        })
        observer.next(value)
        main.emit({
          type: "send-call-return",
          id: emitId,
          observable_id,
        })
      },
      error: (err: any) => {
        const emitId = main.createId()
        main.emit({
          subscription_id,
          type: "send-call",
          id: emitId,
          observable_id,
          kind: "error",
          error: err,
        })
        observer.error(err)
        main.emit({
          type: "send-call-return",
          id: emitId,
          observable_id,
        })
      },
      complete: () => {
        const emitId = main.createId()
        main.emit({
          subscription_id,
          type: "send-call",
          id: emitId,
          observable_id,
          kind: "complete",
        })
        observer.complete()
        main.emit({
          type: "send-call-return",
          id: emitId,
          observable_id,
        })
      },
    }

    const sub = originalSubscribe.call(this, wrappedObserver as any)

    // Attach __id__ to subscription for easy lookup
    ;(sub as any).__id__ = subscription_id

    main.emit({ observable_id, type: "subscribe-call-return", id: subscription_id, subscription: sub })

    // Only patch unsubscribe if not already patched (avoid double-patching in nested subscriptions)
    if (!(sub as any)[RxJSTracker.PATCHED_UNSUB]) {
      const originalUnsubscribe = sub.unsubscribe.bind(sub)
      Object.defineProperty(sub, "unsubscribe", {
        get() {
          return () => {
            main.emit({ observable_id, type: "unsubscribe-call", args, id: subscription_id, index: 0 })
            const result = originalUnsubscribe()
            main.emit({ observable_id, type: "unsubscribe-call-return", id: subscription_id })
            return result
          }
        },
      })
      ;(sub as any)[RxJSTracker.PATCHED_UNSUB] = true
    }

    return sub
  }
}

export const decorateOperatorFun = <T extends Function>(
  operator_fun: T,
  name = operator_fun.name,
  options?: { tags?: string[] },
): T => {
  const decorated = {
    [name]: (...args: any[]) => {
      if (!main.state$.value.isEnabled) return operator_fun(...args)

      const prevTags = main.tagContext
      main.tagContext = options?.tags ?? []
      const id = main.createId()
      main.emit({
        type: "operator-fun-call",
        id,
        name,
        args,
      })
      const out = operator_fun(...args)
      out.operator_fun_id = id
      main.emit({
        type: "operator-fun-call-return",
        id,
      })
      main.tagContext = prevTags
      return out
    },
  }[name]

  ;(decorated! as any).displayName = name
  return decorated as unknown as T
}

export const decorateCreate = <T extends Function>(fun: T, name = fun.name, options?: { tags?: string[] }): T => {
  const decorated = (...args: any[]) => {
    if (!main.state$.value.isEnabled) return fun(...args)

    const prevTags = main.tagContext
    main.tagContext = options?.tags ?? []
    const out = fun(...args)
    main.tagContext = prevTags
    main.emit({
      type: "factory-call-return",
      observable: out,
      args,
      name,
    })
    return out
  }

  decorated.displayName = name

  return decorated as unknown as T
}

export const decorateHigherMap = <T extends Function>(operator_fun: T, name = operator_fun.name) => {}
