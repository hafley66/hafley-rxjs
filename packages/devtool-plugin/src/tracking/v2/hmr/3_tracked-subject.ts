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

import { BehaviorSubject, Subject, Subscription } from "rxjs"
import { __withNoTrack, main, RxJSTracker } from "../0_store"

/**
 * Create a BehaviorSubject that tracks an hmr_track entry.
 * Extends trackedSubject pattern with .value and .getValue() forwarding.
 */
export function trackedSubject<T>(
  class_: any,
  trackId: string,
  initialMutableId?: string,
  initialValue?: T,
): Subject<T> | BehaviorSubject<T> {
  let lastEntityId: string | undefined
  let currentSubject: BehaviorSubject<T> | undefined
  let innerSub: Subscription | null = null
  let isForwarding = false

  // Create proxy BehaviorSubject - tracked so it gets stable_observable_id
  const proxy = new class_(...(class_ === BehaviorSubject ? [initialValue] : [])) as Subject<T> | BehaviorSubject<T>
  // Mark as tracked wrapper so accumulator sets stable_observable_id
  ;(proxy as any)[RxJSTracker.TRACKED_MARKER] = true
  const originalNext = proxy.next.bind(proxy)
  const originalError = proxy.error.bind(proxy)
  const originalComplete = proxy.complete.bind(proxy)

  // Subscribe to inner and forward emissions to proxy (inner→proxy)
  const subscribeToInner = (inner: BehaviorSubject<T>) => {
    __withNoTrack(() => {
      if (innerSub) {
        innerSub.unsubscribe()
        innerSub = null
      }
    })
    innerSub = inner.subscribe({
      next: v => {
        if (!isForwarding) originalNext(v)
      },
      error: e => {
        if (!isForwarding) originalError(e)
      },
      complete: () => {
        if (!isForwarding) originalComplete()
      },
    })
  }

  const getCurrentSubject = (storeSnapshot?: typeof main.state$.value.store): BehaviorSubject<T> | undefined => {
    const store = storeSnapshot ?? main.state$.value.store
    // Lookup by id - O(1). Use passed initialMutableId on first call, then store
    const entityId =
      lastEntityId === undefined && initialMutableId
        ? initialMutableId
        : store.hmr_track[trackId]?.mutable_observable_id
    // Only proceed if observable is actually in store (may still be buffered)
    if (entityId && entityId !== lastEntityId && store.observable[entityId]) {
      lastEntityId = entityId
      const obsRecord = store.observable[entityId]
      const newSubject = obsRecord?.obs_ref?.deref() as BehaviorSubject<T> | undefined
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
    main.state$$.subscribe(s => {
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

  if (class_ === BehaviorSubject) {
    // Override getValue to return current inner's value
    const originalGetValue = (proxy as BehaviorSubject<T>).getValue.bind(proxy)
    ;(proxy as BehaviorSubject<T>).getValue = () => {
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
  }

  // No subscribe override needed - bi-sync already forwards inner→proxy
  // Subscriptions to proxy are tracked with stable ID (track key)

  return proxy
}
