/**
 * HMR Track Runtime
 *
 * __$ wraps RxJS code for HMR tracking. Parser injects these calls.
 * Uses state$.stack.hmr_track for context - accumulator handles push/pop.
 *
 * Returns trackedObservable wrapper for Observables so external subscribers
 * seamlessly receive values from new inner observable after HMR swap.
 */

import { BehaviorSubject, isObservable, Subject } from "rxjs"
import { getObsId, main, RxJSTracker } from "../0_runtime/0_store"
import { findTrackByKey } from "./1_queries"
import { trackedObservable } from "./2_tracked-observable"
import { trackedSubject } from "./3_tracked-subject"

// Only treat direct Subject/BehaviorSubject instances as Subjects
// AnonymousSubject (from .pipe()) should be treated as Observable
// Also exclude our own tracked wrappers
function isRealSubject(val: any): val is Subject<any> {
  if (val == null || isTrackedWrapper(val)) return false
  return val.constructor === Subject || val.constructor === BehaviorSubject
}

function isRealBehaviorSubject(val: any): val is BehaviorSubject<any> {
  if (val == null || isTrackedWrapper(val)) return false
  return val.constructor === BehaviorSubject
}

function isTrackedWrapper(val: any): boolean {
  return val != null && !!(val as any)[RxJSTracker.TRACKED_MARKER]
}

export type TrackContext = <T>(name: string, fn: ($: TrackContext) => T) => T

export function __$<T>(location: string, fn: ($: TrackContext) => T): T {
  // Dynamic observable naming: prepend subscription context if inside send (callback) or subscription (factory)
  // Only add prefix if no track on stack already has subscription context (avoid double-prefix)
  const send = main.state$.value.stack.send.at(-1)
  const sub = main.state$.value.stack.subscription.at(-1)
  try {
    const hasSubscriptionPrefix = main.state$.value.stack.hmr_track.some(t => t.key.startsWith("$ref["))

    // Use send context if in a callback, otherwise use subscription context if in a factory (like defer)
    const subscriptionContext = send?.subscription_id ?? sub?.id
    const observableContext = send?.observable_id ?? sub?.observable_id
    const effectiveLocation =
      subscriptionContext && observableContext && !hasSubscriptionPrefix
        ? `$ref[${observableContext}]:subscription[${subscriptionContext}]:${location}`
        : location

    // Check for existing track (HMR re-execution) or generate new surrogate id
    const existingTrack = findTrackByKey(main.state$.value, effectiveLocation)
    const trackId = existingTrack?.id ?? main.createId()

    main.emit({ type: "track-call", id: trackId, key: effectiveLocation })

    const $: TrackContext = <V>(name: string, childFn: ($: TrackContext) => V): V => {
      return __$(`${effectiveLocation}:${name}`, childFn)
    }

    // Track IDs to emit - set by each observable case
    let mutableId: string | undefined
    let stableId: string | undefined

    try {
      const result = fn($)

      // If result is already a tracked wrapper, just return it
      // (e.g., returning an already-tracked Subject from a nested scope)
      if (isTrackedWrapper(result)) {
        return result
      }

      // If result is a function, wrap to re-invoke __$ on each call
      if (typeof result === "function") {
        const wrapped = (...args: any[]) => {
          return __$(location, () => (result as Function)(...args))
        }
        return wrapped as T
      }

      // If result is a BehaviorSubject, use trackedBehaviorSubject to preserve initial value
      if (isRealBehaviorSubject(result) || isRealSubject(result) || isObservable(result)) {
        mutableId = getObsId(result)
        const trackInStore = main.state$.value.store.hmr_track[trackId]
        const existingStableId = trackInStore?.stable_observable_id
        let stable = existingStableId
          ? main.state$.value.store.observable[existingStableId]?.obs_ref?.deref()
          : undefined
        if (!stable) {
          stable = isRealSubject(result)
            ? trackedSubject(
                result instanceof BehaviorSubject ? BehaviorSubject : Subject,
                trackId,
                mutableId,
                ...(result instanceof BehaviorSubject ? [result.getValue()] : []),
              )
            : trackedObservable(trackId, mutableId)
        }
        stableId = getObsId(stable)
        return stable as T
      }

      return result
    } finally {
      main.emit({
        type: "track-call-return",
        id: trackId,
        mutable_observable_id: mutableId,
        stable_observable_id: stableId,
      })
    }
  } catch (e) {
    console.log(main.state$.value.stack.hmr_track)
    throw e
  }
}
