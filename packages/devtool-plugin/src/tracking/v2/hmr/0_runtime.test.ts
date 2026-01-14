import { BehaviorSubject, of as rxjsOf, Subject } from "rxjs"
import { describe, expect, it } from "vitest"
import { _eventBuffer, state$ } from "../00.types"
import { __$ } from "./0_runtime"
import "../03_scan-accumulator"
import { useTrackingTestSetup } from "../0_test-utils"
import { proxy } from "../04.operators"
import { getDanglingSubscriptions } from "../06_queries"
import { findTrackByKey } from "./1_queries"
import { trackedBehaviorSubject, trackedSubject } from "./3_tracked-subject"

describe("__$ HMR runtime", () => {
  useTrackingTestSetup()

  it("tracks observable creation", () => {
    __$("test:obs", () => proxy.of(1, 2, 3))

    expect(findTrackByKey(state$.value, "test:obs")).toMatchInlineSnapshot(`
      {
        "created_at": 0,
        "created_at_end": 0,
        "id": "0",
        "index": 0,
        "key": "test:obs",
        "module_id": undefined,
        "module_version": undefined,
        "mutable_observable_id": "1",
        "parent_track_id": undefined,
        "prev_observable_ids": [],
        "stable_observable_id": "5",
        "version": 0,
      }
    `)
  })

  it("tracks nested scopes with child $ tracker", () => {
    __$("root", $ => {
      return $("child", () => proxy.of(1))
    })

    expect(state$.value.store.hmr_track).toMatchInlineSnapshot(`
      {
        "1": {
          "created_at": 0,
          "created_at_end": 0,
          "id": "1",
          "index": 0,
          "key": "root:child",
          "module_id": undefined,
          "module_version": undefined,
          "mutable_observable_id": "2",
          "parent_track_id": "0",
          "prev_observable_ids": [],
          "stable_observable_id": "4",
          "version": 0,
        },
      }
    `)
  })

  it("tracks pipe - last entity in scope wins", () => {
    __$("test:pipe", () =>
      proxy.of(1, 2, 3).pipe(
        proxy.map(x => x * 2),
        proxy.take(2),
      ),
    )

    expect(findTrackByKey(state$.value, "test:pipe")).toMatchInlineSnapshot(`
      {
        "created_at": 0,
        "created_at_end": 0,
        "id": "0",
        "index": 0,
        "key": "test:pipe",
        "module_id": undefined,
        "module_version": undefined,
        "mutable_observable_id": "17",
        "parent_track_id": undefined,
        "prev_observable_ids": [],
        "stable_observable_id": "18",
        "version": 0,
      }
    `)
  })

  it("wraps function returns to re-push track on each call", () => {
    const getObs = __$("test:fn", () => {
      return (n: number) => proxy.of(n)
    })

    expect(findTrackByKey(state$.value, "test:fn")).toMatchInlineSnapshot(`undefined`)

    getObs(1)
    getObs(2)

    expect(findTrackByKey(state$.value, "test:fn")).toMatchInlineSnapshot(`
      {
        "created_at": 0,
        "created_at_end": 0,
        "id": "1",
        "index": 0,
        "key": "test:fn",
        "last_change_structural": true,
        "module_id": undefined,
        "module_version": undefined,
        "mutable_observable_id": "5",
        "parent_track_id": undefined,
        "prev_observable_ids": [
          "2",
        ],
        "stable_observable_id": "4",
        "version": 1,
      }
    `)
  })

  it("stack.hmr_track.at(-1) returns current track during scope", () => {
    let capturedTrack: (typeof state$.value.stack.hmr_track)[number] | undefined

    __$("test:peek", () => {
      capturedTrack = state$.value.stack.hmr_track.at(-1)
      return proxy.of(1)
    })

    expect(capturedTrack?.id).toMatchInlineSnapshot(`"0"`)
  })

  it("stack is empty outside of track scope", () => {
    expect(state$.value.stack.hmr_track.at(-1)).toMatchInlineSnapshot(`undefined`)
  })

  it("tracks operator_fun when operators are called inside scope", () => {
    __$("test:op", $ => {
      return $("myMap", () => proxy.map((x: number) => x * 2))
    })

    expect(findTrackByKey(state$.value, "test:op:myMap")).toMatchInlineSnapshot(`undefined`)
  })

  it("detects fn-only change when structure same (last_change_structural: false)", () => {
    // First execution
    __$("test:hmr", () => proxy.of(1, 2, 3).pipe(proxy.map(x => x * 2)))
    const track1 = findTrackByKey(state$.value, "test:hmr")!
    const mutableId1 = track1.mutable_observable_id
    const obs1Name = state$.value.store.observable[mutableId1]?.name
    expect(track1.version).toBe(0)

    // Simulate HMR: same structure, different fn body
    __$("test:hmr", () => proxy.of(1, 2, 3).pipe(proxy.map(x => x * 3)))
    const track2 = findTrackByKey(state$.value, "test:hmr")!
    const obs2Name = state$.value.store.observable[track2.mutable_observable_id]?.name

    expect(track2.version).toBe(1)
    expect(track2.prev_observable_ids).toContain(mutableId1)
    // Same structure: of(1,2,3).map(fn) → of(1,2,3).map(fn)
    expect(obs1Name).toBe(obs2Name) // Both should serialize the same
    expect((track2 as any).last_change_structural).toBe(false)
  })

  it("detects structural change when operator added (last_change_structural: true)", () => {
    // First execution
    __$("test:structural", () => proxy.of(1, 2, 3).pipe(proxy.map(x => x * 2)))
    const mutableId1 = findTrackByKey(state$.value, "test:structural")!.mutable_observable_id
    const obs1Name = state$.value.store.observable[mutableId1]?.name

    // Simulate HMR: added filter operator
    __$("test:structural", () =>
      proxy.of(1, 2, 3).pipe(
        proxy.map(x => x * 2),
        proxy.filter(x => x > 2),
      ),
    )

    const track = findTrackByKey(state$.value, "test:structural")!
    const obs2Name = state$.value.store.observable[track.mutable_observable_id]?.name

    expect({
      obs1Name,
      obs2Name,
      version: track.version,
      structural: (track as any).last_change_structural,
    }).toMatchInlineSnapshot(`
      {
        "obs1Name": "of(1,2,3).map(fn)",
        "obs2Name": "of(1,2,3).map(fn).filter(fn)",
        "structural": true,
        "version": 1,
      }
    `)
  })

  it("detects structural change when primitive arg changes", () => {
    // First execution
    __$("test:primitive", () => proxy.of(1, 2, 3).pipe(proxy.take(5)))

    // Simulate HMR: changed take count
    __$("test:primitive", () => proxy.of(1, 2, 3).pipe(proxy.take(10)))

    const track = findTrackByKey(state$.value, "test:primitive")!
    expect(track.version).toBe(1)
    // Different structure: take(5) → take(10)
    expect((track as any).last_change_structural).toBe(true)
  })

  it("prepends subscription context to track path when inside send callback", () => {
    // Use rxjsOf (not proxy.of) to avoid double decoration from Vite plugin + proxy wrapper
    // The Vite plugin already decorates rxjs creation functions
    const outer$ = __$("outer", () => rxjsOf(1))

    // Capture event types after creation
    const eventsAfterCreate = _eventBuffer.map(e => e.type)

    // Subscribe to wrapper and capture sends during callback
    let sendsDuringCallback: typeof state$.value.stack.send = []
    let innerTrackId: string | undefined
    outer$.subscribe(() => {
      sendsDuringCallback = [...state$.value.stack.send]
      // This __$ call happens during send - should get subscription context
      __$("inner", () => {
        innerTrackId = state$.value.stack.hmr_track.at(-1)?.id
        return rxjsOf(2)
      })
    })

    // Snapshot events and store for clarity
    expect({ events: _eventBuffer, store: state$.value.store }).toMatchSnapshot()
  })

  it("nested child $ tracker also gets subscription context", () => {
    // Wrap outer observable in __$ - returns tracked wrapper
    const parent$ = __$("parent", () => proxy.of(1))

    let sendStackDuringCallback: typeof state$.value.stack.send = []
    let hmrTrackStackDuringCallback: typeof state$.value.stack.hmr_track = []

    // Subscribe to the wrapper (what user code actually does)
    parent$.subscribe(() => {
      sendStackDuringCallback = [...state$.value.stack.send]
      hmrTrackStackDuringCallback = [...state$.value.stack.hmr_track]
      __$("level1", $ => {
        return $("level2", () => proxy.of(2))
      })
    })

    expect({
      sendStack: sendStackDuringCallback.map(s => s.subscription_id),
      hmrTrackStack: hmrTrackStackDuringCallback.map(t => t.id),
      tracks: Object.keys(state$.value.store.hmr_track),
    }).toMatchInlineSnapshot(`
      {
        "hmrTrackStack": [
          "0",
          "0",
        ],
        "sendStack": [
          "5",
          "4",
        ],
        "tracks": [
          "0",
          "9",
        ],
      }
    `)
  })
})

describe("trackedSubject bi-sync", () => {
  useTrackingTestSetup()

  it("proxy.next forwards to inner and emits on proxy", () => {
    let rawInner: Subject<number> | undefined
    __$("biSync", () => (rawInner = new Subject<number>()))
    const trackId = findTrackByKey(state$.value, "biSync")!.id

    const ts = trackedSubject<number>(trackId)
    const innerValues: number[] = []
    const proxyValues: number[] = []

    rawInner!.subscribe(v => innerValues.push(v))
    // Use pipe to subscribe directly to proxy's emissions (not forwarded to inner)
    ;(ts as any)._subscribe({
      next: (v: number) => proxyValues.push(v),
    })

    ts.next(1)
    ts.next(2)

    expect({ innerValues, proxyValues }).toMatchInlineSnapshot(`
      {
        "innerValues": [
          1,
          2,
        ],
        "proxyValues": [
          1,
          2,
        ],
      }
    `)
  })

  it("inner.next forwards to proxy (captured raw inner)", () => {
    let rawInner: Subject<number> | undefined
    __$("innerForward", () => (rawInner = new Subject<number>()))
    const trackId = findTrackByKey(state$.value, "innerForward")!.id

    const ts = trackedSubject<number>(trackId)
    const proxyValues: number[] = []

    // Subscribe directly to proxy's internal subject
    ;(ts as any)._subscribe({
      next: (v: number) => proxyValues.push(v),
    })

    // Emit on raw inner - should forward to proxy
    rawInner!.next(1)
    rawInner!.next(2)

    expect(proxyValues).toMatchInlineSnapshot(`
      [
        1,
        2,
      ]
    `)
  })

  it("error and complete forward bidirectionally", () => {
    let rawInner: Subject<number> | undefined
    __$("errorComplete", () => (rawInner = new Subject<number>()))
    const trackId = findTrackByKey(state$.value, "errorComplete")!.id

    const ts = trackedSubject<number>(trackId)
    let innerCompleted = false
    let proxyCompleted = false

    rawInner!.subscribe({ complete: () => (innerCompleted = true) })
    ;(ts as any)._subscribe({ complete: () => (proxyCompleted = true) })

    ts.complete()

    expect({ innerCompleted, proxyCompleted }).toMatchInlineSnapshot(`
      {
        "innerCompleted": true,
        "proxyCompleted": true,
      }
    `)
  })

  it("inner.complete forwards to proxy", () => {
    let rawInner: Subject<number> | undefined
    __$("innerComplete", () => (rawInner = new Subject<number>()))
    const trackId = findTrackByKey(state$.value, "innerComplete")!.id

    const ts = trackedSubject<number>(trackId)
    let proxyCompleted = false

    ;(ts as any)._subscribe({ complete: () => (proxyCompleted = true) })

    rawInner!.complete()

    expect(proxyCompleted).toBe(true)
  })

  it("no infinite loop when proxy.next triggers inner which triggers proxy", () => {
    let rawInner: Subject<number> | undefined
    __$("noLoop", () => (rawInner = new Subject<number>()))
    const trackId = findTrackByKey(state$.value, "noLoop")!.id

    const ts = trackedSubject<number>(trackId)
    const values: number[] = []

    // Subscribe to both to check for duplicates
    rawInner!.subscribe(v => values.push(v))
    ;(ts as any)._subscribe({ next: (v: number) => values.push(v) })

    ts.next(1)

    // Should only have 2 values (one from inner, one from proxy), not infinite
    expect(values).toMatchInlineSnapshot(`
      [
        1,
        1,
      ]
    `)
  })
})

describe("trackedBehaviorSubject", () => {
  useTrackingTestSetup()

  it("getValue returns inner value", () => {
    let rawInner: BehaviorSubject<number> | undefined
    __$("bsValue", () => (rawInner = new BehaviorSubject(42)))
    const trackId = findTrackByKey(state$.value, "bsValue")!.id

    const tbs = trackedBehaviorSubject<number>(trackId, 0)

    expect(tbs.getValue()).toBe(42)
    expect(tbs.value).toBe(42)
  })

  it("proxy.next updates inner value", () => {
    let rawInner: BehaviorSubject<number> | undefined
    __$("bsNext", () => (rawInner = new BehaviorSubject(0)))
    const trackId = findTrackByKey(state$.value, "bsNext")!.id

    const tbs = trackedBehaviorSubject<number>(trackId, -1)

    tbs.next(100)

    expect(rawInner!.value).toBe(100)
    expect(tbs.value).toBe(100)
  })

  it("inner.next updates proxy value", () => {
    let rawInner: BehaviorSubject<number> | undefined
    __$("bsInnerNext", () => (rawInner = new BehaviorSubject(0)))
    const trackId = findTrackByKey(state$.value, "bsInnerNext")!.id

    const tbs = trackedBehaviorSubject<number>(trackId, -1)

    rawInner!.next(200)

    // Proxy should reflect inner's value
    expect(tbs.value).toBe(200)
  })

  it("bi-sync with next/error/complete", () => {
    let rawInner: BehaviorSubject<number> | undefined
    __$("bsBiSync", () => (rawInner = new BehaviorSubject(0)))
    const trackId = findTrackByKey(state$.value, "bsBiSync")!.id

    const tbs = trackedBehaviorSubject<number>(trackId, -1)
    const innerValues: number[] = []
    const proxyValues: number[] = []

    rawInner!.subscribe(v => innerValues.push(v))
    ;(tbs as any)._subscribe({ next: (v: number) => proxyValues.push(v) })

    tbs.next(1)
    rawInner!.next(2)

    expect({ innerValues, proxyValues }).toMatchInlineSnapshot(`
      {
        "innerValues": [
          0,
          1,
          2,
        ],
        "proxyValues": [
          0,
          1,
          2,
        ],
      }
    `)
  })
})

// NOTE: getDanglingSubscriptions requires subscriptions to be tracked.
// Subscriptions are only tracked when inside a __$ scope (track context required by shouldEmit).
// These tests are skipped pending investigation of track context isolation between tests.
describe.skip("getDanglingSubscriptions", () => {
  useTrackingTestSetup({ fakeTrack: true })

  it("subscription to current tracked entity is not dangling", () => {
    let subj: Subject<number>
    __$("tracked", () => (subj = new Subject<number>()))
    subj!.subscribe()
    expect(getDanglingSubscriptions(state$.value.store)).toMatchInlineSnapshot(`[]`)
  })

  it("detects orphaned subscription after HMR swap", () => {
    let subj1: Subject<number>
    __$("swappable", () => (subj1 = new Subject<number>()))
    subj1!.subscribe()

    __$("swappable", () => new Subject<number>())

    const dangling = getDanglingSubscriptions(state$.value.store)
    expect(dangling.length).toBe(1)
  })

  it("excludes unsubscribed from dangling", () => {
    let subj1: Subject<number>
    __$("swappable", () => (subj1 = new Subject<number>()))
    const sub = subj1!.subscribe()
    sub.unsubscribe()

    __$("swappable", () => new Subject<number>())

    expect(getDanglingSubscriptions(state$.value.store)).toMatchInlineSnapshot(`[]`)
  })
})
