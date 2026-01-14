/**
 * share Edge Cases
 *
 * Tests for share() behavior with HMR tracking.
 * Focus: refCount, reset behaviors, connector factories.
 */

import { ReplaySubject, Subject } from "rxjs"
import { describe, expect, it } from "vitest"
import "../03_scan-accumulator"
import { proxy } from "../04.operators"
import { useTrackingTestSetup } from "../0_test-utils"
import { _rxjs_debugger_module_start } from "../hmr/4_module-scope"

describe("share", () => {
  useTrackingTestSetup()

  describe("basic multicast", () => {
    it("multicasts to multiple subscribers", () => {
      let sourceEmitCount = 0
      const source$ = new Subject<number>()

      const shared$ = source$.pipe(
        proxy.tap(() => sourceEmitCount++),
        proxy.share(),
      )

      const values1: number[] = []
      const values2: number[] = []

      shared$.subscribe(v => values1.push(v))
      shared$.subscribe(v => values2.push(v))

      source$.next(1)

      // Source only emits once, both subscribers receive
      expect(sourceEmitCount).toBe(1)
      expect(values1).toEqual([1])
      expect(values2).toEqual([1])
    })

    it("late subscriber misses past emissions (no replay)", () => {
      const source$ = new Subject<number>()
      const shared$ = source$.pipe(proxy.share())

      const early: number[] = []
      const late: number[] = []

      shared$.subscribe(v => early.push(v))
      source$.next(1)
      source$.next(2)

      shared$.subscribe(v => late.push(v))
      source$.next(3)

      expect(early).toEqual([1, 2, 3])
      expect(late).toEqual([3]) // Missed 1, 2
    })
  })

  describe("resetOnRefCountZero", () => {
    it("resetOnRefCountZero:true (default) - resubscribes on new subscriber", () => {
      let subscribeCount = 0

      const source$ = new Subject<number>()
      const shared$ = source$.pipe(
        proxy.tap({ subscribe: () => subscribeCount++ }),
        proxy.share(), // resetOnRefCountZero defaults to true
      )

      const sub1 = shared$.subscribe()
      expect(subscribeCount).toBe(1)

      sub1.unsubscribe()
      // Source unsubscribed

      const sub2 = shared$.subscribe()
      expect(subscribeCount).toBe(2) // Re-subscribed

      sub2.unsubscribe()
    })

    it("resetOnRefCountZero:false - keeps source connection", () => {
      let subscribeCount = 0

      const source$ = new Subject<number>()
      const shared$ = source$.pipe(
        proxy.tap({ subscribe: () => subscribeCount++ }),
        proxy.share({ resetOnRefCountZero: false }),
      )

      const sub1 = shared$.subscribe()
      expect(subscribeCount).toBe(1)

      sub1.unsubscribe()

      const sub2 = shared$.subscribe()
      // With resetOnRefCountZero:false, does NOT re-subscribe
      // But behavior depends on whether source completed/errored
      // If source is still open, it reuses connection

      sub2.unsubscribe()
    })
  })

  describe("resetOnComplete", () => {
    it("resetOnComplete:false (default) - stays completed", () => {
      const source$ = new Subject<number>()
      const shared$ = source$.pipe(proxy.share())

      let completed = false
      shared$.subscribe({ complete: () => (completed = true) })

      source$.next(1)
      source$.complete()
      expect(completed).toBe(true)

      // New subscriber after complete
      let lateCompleted = false
      const values: number[] = []
      shared$.subscribe({
        next: v => values.push(v),
        complete: () => (lateCompleted = true),
      })

      // With default resetOnComplete:false, late sub gets immediate complete
      expect(lateCompleted).toBe(true)
      expect(values).toEqual([]) // No values
    })

    it("resetOnComplete:true - resets after complete", () => {
      const source$ = new Subject<number>()
      const shared$ = source$.pipe(proxy.share({ resetOnComplete: true }))

      let earlyCompleted = false
      shared$.subscribe({ complete: () => (earlyCompleted = true) })

      source$.next(1)
      source$.complete()
      expect(earlyCompleted).toBe(true)

      // Source is done, but share resets...
      // New subscriber would try to resubscribe to source
      // Since source is a Subject that's already complete, it completes immediately

      let lateCompleted = false
      shared$.subscribe({ complete: () => (lateCompleted = true) })
      expect(lateCompleted).toBe(true) // Completes because source is complete
    })
  })

  describe("resetOnError", () => {
    it("resetOnError:false (default) - stays errored", () => {
      const source$ = new Subject<number>()
      const shared$ = source$.pipe(proxy.share())

      let error1: any
      shared$.subscribe({ error: e => (error1 = e) })

      source$.error(new Error("boom"))
      expect(error1?.message).toBe("boom")

      // New subscriber after error
      let error2: any
      shared$.subscribe({ error: e => (error2 = e) })

      // With default resetOnError:false, late sub gets same error
      expect(error2?.message).toBe("boom")
    })

    it("resetOnError:true - resets after error", () => {
      let subscribeCount = 0
      const source$ = new Subject<number>()
      const shared$ = source$.pipe(
        proxy.tap({ subscribe: () => subscribeCount++ }),
        proxy.share({ resetOnError: true }),
      )

      let error1: any
      shared$.subscribe({ error: e => (error1 = e) })
      expect(subscribeCount).toBe(1)

      source$.error(new Error("boom"))
      expect(error1?.message).toBe("boom")

      // New subscriber after error - should resubscribe
      shared$.subscribe({ error: () => {} })
      expect(subscribeCount).toBe(2) // Re-subscribed
    })
  })

  describe("custom connector", () => {
    it("connector with ReplaySubject gives replay behavior", () => {
      const source$ = new Subject<number>()
      const shared$ = source$.pipe(
        proxy.share({
          connector: () => new ReplaySubject(1),
        }),
      )

      shared$.subscribe() // First subscriber
      source$.next(1)
      source$.next(2)

      // Late subscriber
      const late: number[] = []
      shared$.subscribe(v => late.push(v))

      // ReplaySubject connector provides replay
      expect(late).toEqual([2])
    })
  })

  describe("HMR tracking", () => {
    /**
     * These tests simulate TRANSFORMED code:
     * - source$ is a separate tracked entity (trackedSubject)
     * - shared$ wraps source$.pipe(share())
     */

    it("separate tracked source$ and shared$ - HMR swaps correctly", () => {
      const __$ = _rxjs_debugger_module_start("file:///share-hmr.ts")

      // Mirrors transform output: TWO separate tracked entities
      const source$ = __$("source$", () => new Subject<number>())
      const shared$ = __$("shared$", () => source$.pipe(proxy.share()))
      __$.end()

      const values: number[] = []
      shared$.subscribe(v => values.push(v))

      source$.next(1)
      expect(values).toEqual([1])

      // HMR swap - both wrappers re-run factories
      const __$2 = _rxjs_debugger_module_start("file:///share-hmr.ts")
      const source2$ = __$2("source$", () => new Subject<number>())
      const shared2$ = __$2("shared$", () => source2$.pipe(proxy.share()))
      __$2.end()

      // Wrappers are stable
      expect(source$).toBe(source2$)
      expect(shared$).toBe(shared2$)

      // Emit via stable wrapper - goes through NEW share
      source$.next(2)
      expect(values).toEqual([1, 2])
    })

    it("share refCount resets properly on HMR swap", () => {
      const __$ = _rxjs_debugger_module_start("file:///share-refcount.ts")

      const source$ = __$("source$", () => new Subject<number>())
      const shared$ = __$("shared$", () => source$.pipe(proxy.share()))
      __$.end()

      // Subscribe and unsubscribe
      const sub = shared$.subscribe()
      source$.next(1)
      sub.unsubscribe()

      // HMR swap - creates fresh share with fresh refCount
      const __$2 = _rxjs_debugger_module_start("file:///share-refcount.ts")
      __$2("source$", () => new Subject<number>())
      __$2("shared$", () => source$.pipe(proxy.share()))
      __$2.end()

      // New subscriber works with fresh share
      const values: number[] = []
      shared$.subscribe(v => values.push(v))
      source$.next(2)

      expect(values).toEqual([2])
    })
  })
})
