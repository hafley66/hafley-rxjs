/**
 * Monkey-patches Observable.prototype.pipe and .subscribe
 * Called by vite plugin after Observable class is defined.
 *
 * Checks isEnabled$ to determine if tracking is active.
 */

import type { Observable } from "rxjs"
import type { ObservableEvent } from "./00.types"
import { createId, observableIdMap } from "./01_helpers"

// Late-bound references - set by bootstrap
let _emit: ((event: ObservableEvent) => void) | null = null
let _getIsEnabled: (() => boolean) | null = null
let _getTrackStack: (() => { id: string }[]) | null = null
let _getStore: (() => { observable: Record<string, any>; subscription: Record<string, any> }) | null = null
let _getStack: (() => { subscription: any[] }) | null = null
const _buffer: ObservableEvent[] = []

// Tag context - set by decorators for tagging observables/operators
let _tagContext: string[] = []
export const getTagContext = () => _tagContext

// Marker to identify patched subscriptions (avoid double-patching)
const PATCHED_UNSUB = Symbol("rxjs-debugger-patched-unsubscribe")

// Events that don't require track context at emit time
// - track-*: manage context itself
// - send-*: runtime events, filtered in accumulator
// - subscribe-*: runtime events, gated by store check in patchedSubscribe
// - unsubscribe-*: runtime events
// - hmr-module-*: manage module context itself
const UNTRACKED_EVENTS = new Set([
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

const shouldEmit = (eventType: string): boolean => {
  // Untracked events always emit (regardless of enabled state)
  // This allows track-call/track-call-return during defer factory execution
  // where tracking is disabled to prevent subscribe-call cascades
  if (UNTRACKED_EVENTS.has(eventType)) return true
  const enabled = _getIsEnabled?.() ?? false
  if (!enabled) return false
  // Structured events require track context
  const trackStack = _getTrackStack?.() ?? []
  return trackStack.length > 0
}

export const emit = (event: ObservableEvent) => {
  if (!shouldEmit(event.type)) return
  if (_emit) {
    _emit(event)
  } else {
    _buffer.push(event)
  }
}

export const bootstrap = (
  subject: { next: (e: ObservableEvent) => void },
  getIsEnabled: () => boolean,
  getTrackStack: () => { id: string }[],
  getStore?: () => { observable: Record<string, any>; subscription: Record<string, any> },
  getStack?: () => { subscription: any[] },
) => {
  _emit = e => subject.next(e)
  for (const event of _buffer) {
    _emit(event)
  }
  _buffer.length = 0
  _getIsEnabled = getIsEnabled
  _getTrackStack = getTrackStack
  _getStore = getStore ?? null
  _getStack = getStack ?? null
}

const isEnabled = () => _getIsEnabled?.() ?? false

// Export for constructor injection - used to conditionally create IDs
export { isEnabled as __isEnabled__ }

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
      if (_getIsEnabled) {
        const original = _getIsEnabled
        _getIsEnabled = () => false
        const result = originalCreate(subscribe)
        _getIsEnabled = original
        return result
      }
      return originalCreate(subscribe)
    }
  }

  // Patch pipe
  const originalPipe = proto.pipe

  Object.defineProperty(proto, "pipe", {
    get() {
      const observable_id = observableIdMap.get(this) ?? "UNKNOWN"
      const id = createId()
      emit({ type: "pipe-get", id, observable_id })
      return function patchedPipe(this: Observable<any>, ...args: any[]) {
        if (!isEnabled()) {
          return originalPipe.apply(this, args as any)
        }

        const ind = 0
        emit({ observable_id, type: "pipe-call", args, id, index: ind })

        const decoratedOps = args.map((op, opIndex) => {
          return (source: any) => {
            const opId = createId()
            emit({
              type: "operator-call",
              id: opId,
              operator_fun_id: op?.operator_fun_id ?? "UNKNOWN",
              source_observable_id: observableIdMap.get(source) ?? "UNKNOWN",
              index: opIndex,
            })
            const out = op(source)
            emit({
              type: "operator-call-return",
              id: opId,
              target_observable_id: observableIdMap.get(out) ?? "UNKNOWN",
            })
            return out
          }
        })

        const out = originalPipe.apply(this, decoratedOps as any)
        emit({
          observable_id: observableIdMap.get(out) ?? "UNKNOWN",
          type: "pipe-call-return",
          id,
        })
        return out
      }
    },
  })

  // Patch subscribe
  const originalSubscribe = proto.subscribe
  proto.subscribe = function patchedSubscribe(...args: any[]) {
    // isEnabled controls instance creation - when false, subscription gets __id__ = ""
    if (!isEnabled()) {
      const sub = originalSubscribe.apply(this, args as any)
      ;(sub as any).__id__ = ""
      return sub
    }

    const obs_id = (this as any).__id__ as string | undefined
    const store = _getStore?.()

    // Store-based tracking: observable must have truthy __id__ AND exist in store
    // If not in store, this observable was created without __$ tracking - pass through
    if (!obs_id || !store?.observable[obs_id]) {
      const sub = originalSubscribe.apply(this, args as any)
      ;(sub as any).__id__ = ""
      return sub
    }

    const observable_id = obs_id
    const subscription_id = createId()

    emit({ observable_id, type: "subscribe-call", args, id: subscription_id, index: 0 })

    const observer = normalizeObserver(args)
    let nextIndex = 0

    // Callbacks emit send events with subscription_id
    // Accumulator handles stack push/pop based on these events
    const wrappedObserver = {
      next: (value: any) => {
        const emitId = createId()
        emit({
          subscription_id,
          type: "send-call",
          id: emitId,
          observable_id,
          kind: "next",
          value,
          index: nextIndex++,
        })
        observer.next(value)
        emit({
          type: "send-call-return",
          id: emitId,
          observable_id,
        })
      },
      error: (err: any) => {
        const emitId = createId()
        emit({
          subscription_id,
          type: "send-call",
          id: emitId,
          observable_id,
          kind: "error",
          error: err,
        })
        observer.error(err)
        emit({
          type: "send-call-return",
          id: emitId,
          observable_id,
        })
      },
      complete: () => {
        const emitId = createId()
        emit({
          subscription_id,
          type: "send-call",
          id: emitId,
          observable_id,
          kind: "complete",
        })
        observer.complete()
        emit({
          type: "send-call-return",
          id: emitId,
          observable_id,
        })
      },
    }

    const sub = originalSubscribe.call(this, wrappedObserver as any)

    // Attach __id__ to subscription for easy lookup
    ;(sub as any).__id__ = subscription_id

    emit({ observable_id, type: "subscribe-call-return", id: subscription_id, subscription: sub })

    // Only patch unsubscribe if not already patched (avoid double-patching in nested subscriptions)
    if (!(sub as any)[PATCHED_UNSUB]) {
      const originalUnsubscribe = sub.unsubscribe.bind(sub)
      Object.defineProperty(sub, "unsubscribe", {
        get() {
          return () => {
            emit({ observable_id, type: "unsubscribe-call", args, id: subscription_id, index: 0 })
            const result = originalUnsubscribe()
            emit({ observable_id, type: "unsubscribe-call-return", id: subscription_id })
            return result
          }
        },
      })
      ;(sub as any)[PATCHED_UNSUB] = true
    }

    return sub
  }
}

// Re-export for constructor injection
export { createId, observableIdMap }

export const decorateOperatorFun = <T extends Function>(
  operator_fun: T,
  name = operator_fun.name,
  options?: { tags?: string[] },
): T => {
  const decorated = {
    [name]: (...args: any[]) => {
      const prevTags = _tagContext
      _tagContext = options?.tags ?? []
      const id = createId()
      emit({
        type: "operator-fun-call",
        id,
        name,
        args,
      })
      const out = operator_fun(...args)
      out.operator_fun_id = id
      emit({
        type: "operator-fun-call-return",
        id,
      })
      _tagContext = prevTags
      return out
    },
  }[name]

  ;(decorated! as any).displayName = name
  return decorated as unknown as T
}

export const decorateCreate = <T extends Function>(fun: T, name = fun.name, options?: { tags?: string[] }): T => {
  const decorated = (...args: any[]) => {
    const prevTags = _tagContext
    _tagContext = options?.tags ?? []
    const out = fun(...args)
    _tagContext = prevTags
    emit({
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
