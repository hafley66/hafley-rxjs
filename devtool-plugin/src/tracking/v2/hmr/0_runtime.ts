/**
 * HMR Track Runtime
 *
 * __$ wraps RxJS code for HMR tracking. Parser injects these calls.
 * Uses state$.stack.hmr_track for context - accumulator handles push/pop.
 *
 * Returns trackedObservable wrapper for Observables so external subscribers
 * seamlessly receive values from new inner observable after HMR swap.
 */

import { BehaviorSubject, Observable, Subject } from "rxjs"
import { state$, TRACKED_MARKER } from "../00.types"
import { createId } from "../01_helpers"
import { emit } from "../01.patch-observable"
import { findTrackByKey } from "./1_queries"
import { trackedObservable } from "./2_tracked-observable"
import { trackedBehaviorSubject, trackedSubject } from "./3_tracked-subject"

// Only treat direct Subject/BehaviorSubject instances as Subjects
// AnonymousSubject (from .pipe()) should be treated as Observable
// Also exclude our own tracked wrappers
function isRealSubject(val: any): val is Subject<any> {
  if (val == null) return false
  if ((val as any)[TRACKED_MARKER]) return false // Already tracked
  return val.constructor === Subject || val.constructor === BehaviorSubject
}

function isRealBehaviorSubject(val: any): val is BehaviorSubject<any> {
  if (val == null) return false
  if ((val as any)[TRACKED_MARKER]) return false
  return val.constructor === BehaviorSubject
}

function isTrackedWrapper(val: any): boolean {
  return val != null && !!(val as any)[TRACKED_MARKER]
}

export type TrackContext = <T>(name: string, fn: ($: TrackContext) => T) => T

export function __$<T>(location: string, fn: ($: TrackContext) => T): T {
  // Dynamic observable naming: prepend subscription context if inside send (callback) or subscription (factory)
  // Only add prefix if no track on stack already has subscription context (avoid double-prefix)
  const send = state$.value.stack.send.at(-1)
  const sub = state$.value.stack.subscription.at(-1)
  const hasSubscriptionPrefix = state$.value.stack.hmr_track.some(t => t.key.startsWith("$ref["))

  // Use send context if in a callback, otherwise use subscription context if in a factory (like defer)
  const subscriptionContext = send?.subscription_id ?? sub?.id
  const observableContext = send?.observable_id ?? sub?.observable_id
  const effectiveLocation =
    subscriptionContext && observableContext && !hasSubscriptionPrefix
      ? `$ref[${observableContext}]:subscription[${subscriptionContext}]:${location}`
      : location

  // Check for existing track (HMR re-execution) or generate new surrogate id
  const existingTrack = findTrackByKey(state$.value, effectiveLocation)
  const trackId = existingTrack?.id ?? createId()

  emit({ type: "track-call", id: trackId, key: effectiveLocation })

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
    if (isRealBehaviorSubject(result)) {
      mutableId = (result as any).__id__
      const trackInStore = state$.value.store.hmr_track[trackId]
      const existingStableId = trackInStore?.stable_observable_id
      let stable = existingStableId ? state$.value.store.observable[existingStableId]?.obs_ref?.deref() : undefined
      if (!stable) {
        stable = trackedBehaviorSubject(trackId, result.getValue(), mutableId)
      }
      stableId = (stable as any).__id__
      return stable as T
    }

    // If result is a real Subject (not AnonymousSubject from .pipe()), return stable trackedSubject wrapper
    if (isRealSubject(result)) {
      mutableId = (result as any).__id__
      const trackInStore = state$.value.store.hmr_track[trackId]
      const existingStableId = trackInStore?.stable_observable_id
      let stable = existingStableId ? state$.value.store.observable[existingStableId]?.obs_ref?.deref() : undefined
      if (!stable) {
        stable = trackedSubject(trackId, mutableId)
      }
      stableId = (stable as any).__id__
      return stable as T
    }

    // If result is an Observable (cold), return stable trackedObservable wrapper
    if (result instanceof Observable) {
      mutableId = (result as any).__id__
      const trackInStore = state$.value.store.hmr_track[trackId]
      const existingStableId = trackInStore?.stable_observable_id
      let stable = existingStableId ? state$.value.store.observable[existingStableId]?.obs_ref?.deref() : undefined
      if (!stable) {
        stable = trackedObservable(trackId, mutableId)
      }
      stableId = (stable as any).__id__
      return stable as T
    }

    return result
  } finally {
    emit({ type: "track-call-return", id: trackId, mutable_observable_id: mutableId, stable_observable_id: stableId })
  }
}
