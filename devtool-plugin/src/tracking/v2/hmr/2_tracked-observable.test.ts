import { Subject } from "rxjs"
import { describe, expect, it } from "vitest"
import { state$ } from "../00.types"
import "../03_scan-accumulator"
import { proxy } from "../04.operators"
import { useTrackingTestSetup } from "../0_test-utils"
import { __$ } from "./0_runtime"
import { findTrackByKey } from "./1_queries"
import { trackedObservable } from "./2_tracked-observable"

describe("trackedObservable", () => {
  useTrackingTestSetup()

  it("subscribes to tracked observable and receives emissions", () => {
    const source$ = __$("app:source$", () => new Subject<number>())
    const trackId = findTrackByKey(state$.value, "app:source$")!.id

    const tracked$ = trackedObservable<number>(trackId)
    const values: number[] = []
    const sub = tracked$.subscribe(v => {
      values.push(v)
    })

    source$.next(1)
    source$.next(2)
    source$.next(3)

    expect(values).toEqual([1, 2, 3])
    sub.unsubscribe()
  })

  it("switches source on HMR re-execution", () => {
    // Capture raw inner Subjects via side effect
    let rawSource1$!: Subject<number>
    let rawSource2$!: Subject<number>

    const wrapper1$ = __$("app:counter$", () => (rawSource1$ = new Subject<number>()))
    const trackId = findTrackByKey(state$.value, "app:counter$")!.id

    const tracked$ = trackedObservable<number>(trackId)
    const values: number[] = []
    const sub = tracked$.subscribe(v => values.push(v))

    rawSource1$.next(1)
    expect(values).toEqual([1])

    // HMR re-execution - same location, new Subject
    const wrapper2$ = __$("app:counter$", () => (rawSource2$ = new Subject<number>()))

    // Wrappers are same stable reference
    expect(wrapper1$).toBe(wrapper2$)

    // Old RAW source orphaned - emissions don't reach tracked$
    rawSource1$.next(999)
    expect(values).toEqual([1])

    // New RAW source works
    rawSource2$.next(2)
    rawSource2$.next(3)
    expect(values).toEqual([1, 2, 3])

    sub.unsubscribe()
  })

  it("subscription survives HMR swap", () => {
    const source1$ = __$("app:data$", () => new Subject<number>())
    const trackId = findTrackByKey(state$.value, "app:data$")!.id

    const tracked$ = trackedObservable<number>(trackId)
    let completed = false
    const sub = tracked$.subscribe({
      next: () => {},
      complete: () => {
        completed = true
      },
    })

    // HMR re-execution - same location, new Subject
    __$("app:data$", () => new Subject<number>())

    expect(completed).toBe(false)
    expect(sub.closed).toBe(false)

    sub.unsubscribe()
  })

  it("cleans up inner subscription on unsubscribe", () => {
    const source$ = __$("app:stream$", () => new Subject<number>())
    const trackId = findTrackByKey(state$.value, "app:stream$")!.id

    const tracked$ = trackedObservable<number>(trackId)
    const values: number[] = []
    const sub = tracked$.subscribe(v => values.push(v))

    source$.next(1)
    sub.unsubscribe()
    source$.next(2)

    expect(values).toEqual([1])
  })

  it("works with hot source and pipe", () => {
    const input$ = new Subject<number>()
    __$("app:piped$", () => input$.pipe(proxy.map(x => x * 10)))
    const trackId = findTrackByKey(state$.value, "app:piped$")!.id

    const tracked$ = trackedObservable<number>(trackId)
    const values: number[] = []
    tracked$.subscribe(v => values.push(v))

    input$.next(1)
    input$.next(2)
    input$.next(3)

    expect(values).toEqual([10, 20, 30])
  })

  it("forwards complete when no swap has occurred", () => {
    const source$ = __$("app:finite$", () => new Subject<number>())
    const trackId = findTrackByKey(state$.value, "app:finite$")!.id

    const tracked$ = trackedObservable<number>(trackId)
    let completed = false
    tracked$.subscribe({
      next: () => {},
      complete: () => {
        completed = true
      },
    })

    // Complete the source - should forward since no swap
    source$.complete()
    expect(completed).toBe(true)
  })

  it("forwards complete after HMR swap - preserves RxJS semantics", () => {
    const source1$ = __$("app:hmr$", () => new Subject<number>())
    const trackId = findTrackByKey(state$.value, "app:hmr$")!.id

    const tracked$ = trackedObservable<number>(trackId)
    let completed = false
    const values: number[] = []
    tracked$.subscribe({
      next: v => values.push(v),
      complete: () => {
        completed = true
      },
    })

    source1$.next(1)

    // HMR swap - same location, new factory result triggers re-execution detection
    const source2$ = __$("app:hmr$", () => new Subject<number>())

    source2$.next(2)
    source2$.next(3)

    // Complete propagates naturally - don't break RxJS semantics
    source2$.complete()

    expect(completed).toBe(true)
    expect(values).toEqual([1, 2, 3])
  })
})
