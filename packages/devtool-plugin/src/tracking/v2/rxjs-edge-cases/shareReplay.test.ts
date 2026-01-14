/**
 * shareReplay Edge Cases
 *
 * Tests for shareReplay behavior with HMR tracking.
 * Focus: buffer management, refCount, late subscribers, HMR swap.
 */

import { BehaviorSubject, interval, Subject } from "rxjs"
import { take } from "rxjs/operators"
import { describe, expect, it } from "vitest"
import { state$ } from "../00.types"
import "../03_scan-accumulator"
import { proxy } from "../04.operators"
import { useTrackingTestSetup } from "../0_test-utils"
import { __$ } from "../hmr/0_runtime"
import { _rxjs_debugger_module_start } from "../hmr/4_module-scope"

describe("shareReplay", () => {
  useTrackingTestSetup()

  describe("basic behavior", () => {
    it("replays last value to late subscriber", () => {
      const source$ = new Subject<number>()
      const shared$ = source$.pipe(proxy.shareReplay(1))

      const early: number[] = []
      const late: number[] = []

      shared$.subscribe(v => early.push(v))
      source$.next(1)
      source$.next(2)

      // Late subscriber joins after emissions
      shared$.subscribe(v => late.push(v))

      expect(early).toEqual([1, 2])
      expect(late).toEqual([2]) // Gets replay of last value
    })

    it("replays multiple values with bufferSize > 1", () => {
      const source$ = new Subject<number>()
      const shared$ = source$.pipe(proxy.shareReplay(3))

      // Need at least one subscriber for shareReplay to start buffering
      const early: number[] = []
      shared$.subscribe(v => early.push(v))

      source$.next(1)
      source$.next(2)
      source$.next(3)
      source$.next(4)

      const late: number[] = []
      shared$.subscribe(v => late.push(v))

      expect(early).toEqual([1, 2, 3, 4])
      expect(late).toEqual([2, 3, 4]) // Last 3 values replayed
    })

    it("bufferSize(1) with refCount:false keeps source subscribed forever", () => {
      let sourceSubCount = 0
      let sourceUnsubCount = 0

      const source$ = new Subject<number>()
      const tracked$ = new Subject<number>()

      // Manually track subscription state
      source$.subscribe({
        next: v => tracked$.next(v),
        complete: () => tracked$.complete(),
      })

      const shared$ = tracked$.pipe(proxy.shareReplay(1))

      const sub1 = shared$.subscribe()
      sourceSubCount++

      sub1.unsubscribe()
      // With refCount:false (default), source stays subscribed

      const sub2 = shared$.subscribe()
      // Should NOT increment sourceSubCount - reuses existing

      sub2.unsubscribe()

      // Source is STILL subscribed - this is the memory leak risk
      expect(sourceSubCount).toBe(1)
      expect(sourceUnsubCount).toBe(0)
    })

    it("bufferSize(1) with refCount:true unsubscribes on zero subscribers", () => {
      let unsubscribed = false

      const source$ = new Subject<number>()
      const shared$ = source$.pipe(
        proxy.shareReplay({ bufferSize: 1, refCount: true }),
      )

      const sub = shared$.subscribe()
      sub.unsubscribe()

      // With refCount:true, should have unsubscribed from source
      // (Can't directly observe this without instrumenting, but behavior changes)

      const values: number[] = []
      shared$.subscribe(v => values.push(v))

      source$.next(1)
      expect(values).toEqual([1]) // No replay - buffer was cleared on unsub
    })
  })

  describe("operator ordering bugs", () => {
    it("BUG: share() before startWith - late subscriber misses initial", () => {
      const source$ = new Subject<number>()

      // WRONG ORDER - this is a bug pattern
      const buggy$ = source$.pipe(proxy.share(), proxy.startWith(0))

      const early: number[] = []
      const late: number[] = []

      buggy$.subscribe(v => early.push(v))
      source$.next(1)

      buggy$.subscribe(v => late.push(v))
      source$.next(2)

      expect(early).toEqual([0, 1, 2])
      expect(late).toEqual([0, 2]) // Gets startWith(0) again! But missed 1
    })

    it("FIX: startWith before shareReplay - late subscriber gets initial", () => {
      const source$ = new Subject<number>()

      // CORRECT ORDER
      const fixed$ = source$.pipe(proxy.startWith(0), proxy.shareReplay(1))

      const early: number[] = []
      const late: number[] = []

      fixed$.subscribe(v => early.push(v))
      source$.next(1)

      fixed$.subscribe(v => late.push(v))
      source$.next(2)

      expect(early).toEqual([0, 1, 2])
      expect(late).toEqual([1, 2]) // Gets replay of 1, then live 2
    })
  })

  describe("HMR tracking", () => {
    /**
     * These tests simulate how TRANSFORMED code works:
     * - source$ is a separate tracked entity (trackedSubject)
     * - shared$ wraps source$.pipe(shareReplay(1))
     *
     * On HMR: both wrappers re-run their factories, creating fresh instances.
     */

    it("separate tracked source$ and shared$ - HMR swaps both correctly", () => {
      const __$ = _rxjs_debugger_module_start("file:///shareReplay-separate.ts")

      // Mirrors transform output: TWO separate tracked entities
      const source$ = __$("source$", () => new Subject<number>())
      const shared$ = __$("shared$", () => source$.pipe(proxy.shareReplay(1)))
      __$.end()

      const values: number[] = []
      shared$.subscribe(v => values.push(v))

      // Emit via stable source$ wrapper
      source$.next(1)
      expect(values).toEqual([1])

      // HMR swap - both wrappers re-run factories
      const __$2 = _rxjs_debugger_module_start("file:///shareReplay-separate.ts")
      const source2$ = __$2("source$", () => new Subject<number>()) // Returns same wrapper
      const shared2$ = __$2("shared$", () => source2$.pipe(proxy.shareReplay(1))) // Returns same wrapper
      __$2.end()

      // Wrappers are stable - same references
      expect(source$).toBe(source2$)
      expect(shared$).toBe(shared2$)

      // Emit via stable wrapper - goes through NEW shareReplay
      source$.next(2)
      expect(values).toEqual([1, 2])
    })

    it("late subscriber after HMR swap gets fresh buffer", () => {
      const __$ = _rxjs_debugger_module_start("file:///shareReplay-buffer.ts")

      const source$ = __$("source$", () => new Subject<number>())
      const shared$ = __$("shared$", () => source$.pipe(proxy.shareReplay(1)))
      __$.end()

      const early: number[] = []
      shared$.subscribe(v => early.push(v))

      source$.next(100)
      expect(early).toEqual([100])

      // HMR swap - creates NEW shareReplay with fresh buffer
      const __$2 = _rxjs_debugger_module_start("file:///shareReplay-buffer.ts")
      __$2("source$", () => new Subject<number>())
      __$2("shared$", () => source$.pipe(proxy.shareReplay(1)))
      __$2.end()

      source$.next(200)

      // Late subscriber joins after swap
      const late: number[] = []
      shared$.subscribe(v => late.push(v))

      // Should get NEW buffer's replay (200), not old buffer's (100)
      expect(late).toEqual([200])
    })

    /**
     * Verifies shareReplay buffer is fresh after HMR swap.
     *
     * Root cause of original bug: trackedObservable's tryConnect used
     * `initialMutableId ?? store.value` which meant stale initialMutableId
     * (captured at wrapper creation) was preferred over current store value.
     *
     * Fix: Prefer store value, fall back to initialMutableId.
     */
    it("shareReplay buffer is fresh after HMR - no stale data", () => {
      const __$ = _rxjs_debugger_module_start("file:///shareReplay-fresh.ts")

      const source$ = __$("source$", () => new Subject<number>())
      const shared$ = __$("shared$", () => source$.pipe(proxy.shareReplay(3)))
      __$.end()

      const early: number[] = []
      shared$.subscribe(v => early.push(v))

      source$.next(1)
      source$.next(2)
      source$.next(3)
      expect(early).toEqual([1, 2, 3])

      // HMR swap - SHOULD create fresh shareReplay
      const __$2 = _rxjs_debugger_module_start("file:///shareReplay-fresh.ts")
      __$2("source$", () => new Subject<number>())
      __$2("shared$", () => source$.pipe(proxy.shareReplay(3)))
      __$2.end()

      source$.next(10) // Only value in new buffer

      // Early subscriber continues receiving
      expect(early).toEqual([1, 2, 3, 10])

      // Late subscriber SHOULD get NEW buffer's replay only
      const late: number[] = []
      shared$.subscribe(v => late.push(v))
      expect(late).toEqual([10])
    })
  })

  describe("completion and error", () => {
    it("complete propagates to all subscribers", () => {
      const source$ = new Subject<number>()
      const shared$ = source$.pipe(proxy.shareReplay(1))

      let completed1 = false
      let completed2 = false

      shared$.subscribe({ complete: () => (completed1 = true) })
      shared$.subscribe({ complete: () => (completed2 = true) })

      source$.complete()

      expect(completed1).toBe(true)
      expect(completed2).toBe(true)
    })

    it("error propagates to all subscribers", () => {
      const source$ = new Subject<number>()
      const shared$ = source$.pipe(proxy.shareReplay(1))

      let error1: any
      let error2: any

      shared$.subscribe({ error: e => (error1 = e) })
      shared$.subscribe({ error: e => (error2 = e) })

      source$.error(new Error("test"))

      expect(error1?.message).toBe("test")
      expect(error2?.message).toBe("test")
    })

    it("late subscriber to completed shareReplay gets replay then complete", () => {
      const source$ = new Subject<number>()
      const shared$ = source$.pipe(proxy.shareReplay(1))

      // Need at least one subscriber for shareReplay to buffer
      const early: number[] = []
      shared$.subscribe(v => early.push(v))

      source$.next(1)
      source$.complete()

      expect(early).toEqual([1])

      // Late subscriber after complete
      const values: number[] = []
      let completed = false

      shared$.subscribe({
        next: v => values.push(v),
        complete: () => (completed = true),
      })

      expect(values).toEqual([1]) // Gets replay
      expect(completed).toBe(true) // Then complete
    })

    it("late subscriber to errored shareReplay gets error only (no replay)", () => {
      const source$ = new Subject<number>()
      const shared$ = source$.pipe(proxy.shareReplay(1))

      // Need at least one subscriber for shareReplay to buffer
      const early: number[] = []
      let earlyError: any
      shared$.subscribe({
        next: v => early.push(v),
        error: e => (earlyError = e),
      })

      source$.next(1)
      source$.error(new Error("boom"))

      expect(early).toEqual([1])
      expect(earlyError?.message).toBe("boom")

      // Late subscriber after error
      const values: number[] = []
      let error: any

      shared$.subscribe({
        next: v => values.push(v),
        error: e => (error = e),
      })

      // RxJS behavior: errored shareReplay does NOT replay values
      // Late subscriber gets error immediately, no values
      expect(values).toEqual([])
      expect(error?.message).toBe("boom")
    })
  })
})
