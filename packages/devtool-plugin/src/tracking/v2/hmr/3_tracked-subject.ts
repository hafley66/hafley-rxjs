/**
 * Tracked Subject
 *
 * Returns a Subject that forwards to the current inner Subject.
 * When hmr_track.mutable_observable_id changes, subsequent calls forward to the new Subject.
 *
 * Bi-directional sync:
 * - proxy.next/error/complete → forwards to inner
 * - inner.next/error/complete → forwards to proxy (for captured raw inner)
 */

import { BehaviorSubject, Subject, type Subscription } from "rxjs"
import { __withNoTrack, state$, TRACKED_MARKER } from "../00.types"
import { state$$ } from "../03_scan-accumulator"

/**
 * Create a Subject that tracks an hmr_track entry.
 * All methods forward to the current inner Subject based on mutable_observable_id.
 */
export function trackedSubject<T>(trackId: string, initialMutableId?: string): Subject<T> {
  let lastEntityId: string | undefined
  let currentSubject: Subject<T> | undefined
  let innerSub: Subscription | null = null
  let isForwarding = false // prevent proxy→inner→proxy loops

  // Create proxy Subject - tracked so it gets stable_observable_id
  const proxy = new Subject<T>()
  // Mark as tracked wrapper so accumulator sets stable_observable_id
  ;(proxy as any)[TRACKED_MARKER] = true
  const originalNext = proxy.next.bind(proxy)
  const originalError = proxy.error.bind(proxy)
  const originalComplete = proxy.complete.bind(proxy)

  // Subscribe to inner and forward emissions to proxy (inner→proxy)
  const subscribeToInner = (inner: Subject<T>) => {
    if (innerSub) {
      innerSub.unsubscribe()
      innerSub = null
    }
    innerSub = __withNoTrack(() =>
      inner.subscribe({
        next: (v) => {
          if (!isForwarding) originalNext(v)
        },
        error: (e) => {
          if (!isForwarding) originalError(e)
        },
        complete: () => {
          if (!isForwarding) originalComplete()
        },
      }),
    )
  }

  const getCurrentSubject = (storeSnapshot?: typeof state$.value.store): Subject<T> | undefined => {
    const store = storeSnapshot ?? state$.value.store
    // Lookup by id - O(1). Use passed initialMutableId on first call, then store
    const entityId = lastEntityId === undefined && initialMutableId
      ? initialMutableId
      : store.hmr_track[trackId]?.mutable_observable_id
    // Only proceed if observable is actually in store (may still be buffered)
    if (entityId && entityId !== lastEntityId && store.observable[entityId]) {
      lastEntityId = entityId
      const obsRecord = store.observable[entityId]
      const newSubject = obsRecord?.obs_ref?.deref() as Subject<T> | undefined
      if (newSubject && newSubject !== currentSubject) {
        currentSubject = newSubject
        subscribeToInner(currentSubject)
      }
    }
    return currentSubject
  }

  // Initial lookup
  getCurrentSubject()

  // Watch for HMR changes - update inner subscription when entity_id changes
  const watcherSub = __withNoTrack(() =>
    state$$.subscribe(s => {
      getCurrentSubject(s.store)
    }),
  )

  // Teardown: self-subscribe to detect complete, clean up watcher and inner
  // Subject is multicast so this extra subscriber is fine
  __withNoTrack(() =>
    proxy.subscribe({
      complete: () => {
        innerSub?.unsubscribe()
        watcherSub.unsubscribe()
      },
    }),
  )

  // Override next/error/complete to forward to current inner Subject (proxy→inner)
  proxy.next = (value: T) => {
    const inner = getCurrentSubject()
    if (inner) {
      isForwarding = true
      try {
        inner.next(value)
      } finally {
        isForwarding = false
      }
    }
    originalNext(value)
  }

  proxy.error = (err: any) => {
    const inner = getCurrentSubject()
    if (inner) {
      isForwarding = true
      try {
        inner.error(err)
      } finally {
        isForwarding = false
      }
    }
    originalError(err)
  }

  proxy.complete = () => {
    const inner = getCurrentSubject()
    if (inner) {
      isForwarding = true
      try {
        inner.complete()
      } finally {
        isForwarding = false
      }
    }
    originalComplete()
  }

  // No subscribe override needed - bi-sync already forwards inner→proxy
  // Subscriptions to proxy are tracked with stable ID (track key)

  return proxy
}

/**
 * Create a BehaviorSubject that tracks an hmr_track entry.
 * Extends trackedSubject pattern with .value and .getValue() forwarding.
 */
export function trackedBehaviorSubject<T>(
  trackId: string,
  initialValue: T,
  initialMutableId?: string,
): BehaviorSubject<T> {
  let lastEntityId: string | undefined
  let currentSubject: BehaviorSubject<T> | undefined
  let innerSub: Subscription | null = null
  let isForwarding = false

  // Create proxy BehaviorSubject - tracked so it gets stable_observable_id
  const proxy = new BehaviorSubject<T>(initialValue)
  // Mark as tracked wrapper so accumulator sets stable_observable_id
  ;(proxy as any)[TRACKED_MARKER] = true
  const originalNext = proxy.next.bind(proxy)
  const originalError = proxy.error.bind(proxy)
  const originalComplete = proxy.complete.bind(proxy)

  // Subscribe to inner and forward emissions to proxy (inner→proxy)
  const subscribeToInner = (inner: BehaviorSubject<T>) => {
    if (innerSub) {
      innerSub.unsubscribe()
      innerSub = null
    }
    innerSub = __withNoTrack(() =>
      inner.subscribe({
        next: (v) => {
          if (!isForwarding) originalNext(v)
        },
        error: (e) => {
          if (!isForwarding) originalError(e)
        },
        complete: () => {
          if (!isForwarding) originalComplete()
        },
      }),
    )
  }

  const getCurrentSubject = (storeSnapshot?: typeof state$.value.store): BehaviorSubject<T> | undefined => {
    const store = storeSnapshot ?? state$.value.store
    // Lookup by id - O(1). Use passed initialMutableId on first call, then store
    const entityId = lastEntityId === undefined && initialMutableId
      ? initialMutableId
      : store.hmr_track[trackId]?.mutable_observable_id
    // Only proceed if observable is actually in store (may still be buffered)
    if (entityId && entityId !== lastEntityId && store.observable[entityId]) {
      lastEntityId = entityId
      const obsRecord = store.observable[entityId]
      const newSubject = obsRecord?.obs_ref?.deref() as
        | BehaviorSubject<T>
        | undefined
      if (newSubject && newSubject !== currentSubject) {
        currentSubject = newSubject
        subscribeToInner(currentSubject)
      }
    }
    return currentSubject
  }

  // Initial lookup
  getCurrentSubject()

  // Watch for HMR changes
  const watcherSub = __withNoTrack(() =>
    state$$.subscribe(s => {
      getCurrentSubject(s.store)
    }),
  )

  // Teardown: self-subscribe to detect complete, clean up watcher and inner
  // Subject is multicast so this extra subscriber is fine
  __withNoTrack(() =>
    proxy.subscribe({
      complete: () => {
        innerSub?.unsubscribe()
        watcherSub.unsubscribe()
      },
    }),
  )

  // Override next/error/complete to forward to current inner Subject (proxy→inner)
  proxy.next = (value: T) => {
    const inner = getCurrentSubject()
    if (inner) {
      isForwarding = true
      try {
        inner.next(value)
      } finally {
        isForwarding = false
      }
    }
    originalNext(value)
  }

  proxy.error = (err: any) => {
    const inner = getCurrentSubject()
    if (inner) {
      isForwarding = true
      try {
        inner.error(err)
      } finally {
        isForwarding = false
      }
    }
    originalError(err)
  }

  proxy.complete = () => {
    const inner = getCurrentSubject()
    if (inner) {
      isForwarding = true
      try {
        inner.complete()
      } finally {
        isForwarding = false
      }
    }
    originalComplete()
  }

  // Override getValue to return current inner's value
  const originalGetValue = proxy.getValue.bind(proxy)
  proxy.getValue = () => {
    const inner = getCurrentSubject()
    return inner ? inner.getValue() : originalGetValue()
  }

  // Override value getter to return current inner's value
  Object.defineProperty(proxy, "value", {
    get() {
      const inner = getCurrentSubject()
      return inner ? inner.value : originalGetValue()
    },
  })

  // No subscribe override needed - bi-sync already forwards inner→proxy
  // Subscriptions to proxy are tracked with stable ID (track key)

  return proxy
}
