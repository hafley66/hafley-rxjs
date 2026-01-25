import { describe, expect, it } from "vitest"
import {
  DietBehaviorSubject,
  DietObservable,
  DietReplaySubject,
  DietSubject,
  dietDistinctUntilChanged,
  dietFilter,
  dietMap,
  dietShareRefCount,
  dietTake,
  EasierDietBS,
} from "./2_diet_rxjs"

describe("DietObservable", () => {
  it("emits values and calls teardown", () => {
    const values: number[] = []
    const obs = new DietObservable<number>(observer => {
      observer.next?.(1)
      observer.next?.(2)
      observer.complete?.()
      return () => values.push(-1)
    })
    const sub = obs.subscribe(v => values.push(v))
    expect(values).toEqual([1, 2])
    sub.unsubscribe()
    expect(values).toEqual([1, 2, -1])
    expect(sub.closed).toBe(true)
    sub.unsubscribe()
    expect(values).toEqual([1, 2, -1])
  })
})

describe("DietSubject", () => {
  it("multicasts to active subscribers", () => {
    const values: number[] = []
    const subj = new DietSubject<number>()

    subj.next(0) // no subscribers
    const sub1 = subj.subscribe(v => values.push(v))
    subj.next(1)
    const sub2 = subj.subscribe(v => values.push(v * 10))
    subj.next(2)
    sub1.unsubscribe()
    subj.next(3)

    expect(values).toEqual([1, 2, 20, 30])
    expect(subj.observers.size).toBe(1)
    sub2.unsubscribe()
    expect(subj.observers.size).toBe(0)
  })

  it("notifies on complete and clears observers", () => {
    const subj = new DietSubject<number>()
    let completed = false
    subj.subscribe({
      complete: () => {
        completed = true
      },
    })
    subj.complete()

    expect(completed).toBe(true)
    expect(subj.isStopped).toBe(true)
    expect(subj.observers.size).toBe(0)

    let lateCompleted = false
    subj.subscribe({
      complete: () => {
        lateCompleted = true
      },
    })
    expect(lateCompleted).toBe(true)
  })

  it("notifies on error and clears observers", () => {
    const subj = new DietSubject<number>()
    let receivedErr: unknown = null
    subj.subscribe({
      error: e => {
        receivedErr = e
      },
    })
    subj.error("boom")

    expect(receivedErr).toBe("boom")
    expect(subj.hasError).toBe(true)
    expect(subj.thrownError).toBe("boom")

    let lateErr: unknown = null
    subj.subscribe({
      error: e => {
        lateErr = e
      },
    })
    expect(lateErr).toBe("boom")
  })
})

describe("DietBehaviorSubject", () => {
  it("emits current value on subscribe", () => {
    const values: number[] = []
    const bs = new DietBehaviorSubject(42)

    expect(bs.value).toBe(42)
    expect(bs.getValue()).toBe(42)

    bs.subscribe(v => values.push(v))
    expect(values).toEqual([42])

    bs.next(100)
    expect(values).toEqual([42, 100])
    expect(bs.value).toBe(100)

    const lateValues: number[] = []
    bs.subscribe(v => lateValues.push(v))
    expect(lateValues).toEqual([100])
  })

  it("throws on getValue when errored", () => {
    const bs = new DietBehaviorSubject(1)
    bs.error("oops")
    expect(() => bs.getValue()).toThrow()
  })
})

describe("pipe and operators", () => {
  it("chains filter and map", () => {
    const values: number[] = []
    const subj = new DietSubject<number>()

    subj
      .pipe(
        dietFilter(x => x % 2 === 0),
        dietMap(x => x * 10),
      )
      .subscribe(v => values.push(v))

    subj.next(1)
    subj.next(2)
    subj.next(3)
    subj.next(4)

    expect(values).toEqual([20, 40])
  })

  it("dietTake limits and completes", () => {
    const values: number[] = []
    let completed = false
    const subj = new DietSubject<number>()

    subj.pipe(dietTake(2)).subscribe({
      next: v => values.push(v),
      complete: () => {
        completed = true
      },
    })

    subj.next(1)
    subj.next(2)
    subj.next(3)

    expect(values).toEqual([1, 2])
    expect(completed).toBe(true)
  })

  it("dietDistinctUntilChanged filters consecutive dupes", () => {
    const values: number[] = []
    const subj = new DietSubject<number>()

    subj.pipe(dietDistinctUntilChanged()).subscribe(v => values.push(v))

    subj.next(1)
    subj.next(1)
    subj.next(2)
    subj.next(2)
    subj.next(1)

    expect(values).toEqual([1, 2, 1])
  })
})

describe("asObservable", () => {
  it("hides subject methods but still receives values", () => {
    const subj = new DietSubject<number>()
    const obs = subj.asObservable()

    expect("next" in obs).toBe(false)

    const values: number[] = []
    obs.subscribe(v => values.push(v))
    subj.next(1)
    expect(values).toEqual([1])
  })
})

describe("unsubscribe", () => {
  it("prevents further emissions", () => {
    const values: number[] = []
    const subj = new DietSubject<number>()
    const sub = subj.subscribe(v => values.push(v))

    subj.next(1)
    sub.unsubscribe()
    subj.next(2)

    expect(values).toEqual([1])
    expect(sub.closed).toBe(true)
  })
})

describe("EasierDietBS", () => {
  it("set() merges partial into current value", () => {
    const bs = new EasierDietBS({ a: 1, b: 2 })
    bs.set({ a: 10 })
    expect(bs.value).toEqual({ a: 10, b: 2 })
  })

  it("reset() restores to initial value and emits on reset$", () => {
    const bs = new EasierDietBS({ count: 0 })
    const resets: null[] = []
    bs.reset$.subscribe(v => resets.push(v))

    bs.next({ count: 100 })
    expect(bs.value).toEqual({ count: 100 })

    bs.reset()
    expect(bs.value).toEqual({ count: 0 })
    expect(resets).toEqual([null])
  })

  it("reset uses a safe clone, not shared reference", () => {
    const bs = new EasierDietBS({ items: [1, 2, 3] })
    bs.value.items.push(4) // mutate
    bs.reset()
    expect(bs.value).toEqual({ items: [1, 2, 3] })
  })

  describe("scanEager", () => {
    it("emits initial value immediately on subscribe", () => {
      const bs = new EasierDietBS({ total: 0 })
      const source$ = new DietSubject<number>()
      const emitted: { total: number }[] = []

      source$.pipe(bs.scanEager((sum, n) => ({ total: sum.total + n }))).subscribe(v => emitted.push(v))

      expect(emitted).toEqual([{ total: 0 }])
      expect(bs.value).toEqual({ total: 0 })
    })

    it("accumulates values and pushes to BehaviorSubject", () => {
      const bs = new EasierDietBS({ total: 0 })
      const source$ = new DietSubject<number>()
      const emitted: { total: number }[] = []

      source$.pipe(bs.scanEager((sum, n) => ({ total: sum.total + n }))).subscribe(v => emitted.push(v))

      source$.next(5)
      source$.next(10)
      source$.next(3)

      expect(emitted).toEqual([{ total: 0 }, { total: 5 }, { total: 15 }, { total: 18 }])
      expect(bs.value).toEqual({ total: 18 })
    })

    it("reset$ triggers fresh accumulation from initial value", () => {
      const bs = new EasierDietBS({ total: 0 })
      const source$ = new DietSubject<number>()
      const emitted: { total: number }[] = []

      source$.pipe(bs.scanEager((sum, n) => ({ total: sum.total + n }))).subscribe(v => emitted.push(v))

      source$.next(5)
      source$.next(10)
      expect(bs.value).toEqual({ total: 15 })

      bs.reset()
      expect(emitted).toEqual([{ total: 0 }, { total: 5 }, { total: 15 }, { total: 0 }])
      expect(bs.value).toEqual({ total: 0 })

      source$.next(100)
      expect(emitted).toEqual([{ total: 0 }, { total: 5 }, { total: 15 }, { total: 0 }, { total: 100 }])
      expect(bs.value).toEqual({ total: 100 })
    })

    it("unsubscribe cleans up both source and reset subscriptions", () => {
      const bs = new EasierDietBS({ total: 0 })
      const source$ = new DietSubject<number>()
      const emitted: { total: number }[] = []

      const sub = source$.pipe(bs.scanEager((sum, n) => ({ total: sum.total + n }))).subscribe(v => emitted.push(v))

      source$.next(5)
      sub.unsubscribe()

      source$.next(999)
      bs.reset()

      // No new emissions after unsubscribe
      expect(emitted).toEqual([{ total: 0 }, { total: 5 }])
    })
  })
})

describe("DietReplaySubject", () => {
  it("replays buffered values to new subscribers", () => {
    const subj = new DietReplaySubject<number>()
    subj.next(1)
    subj.next(2)
    subj.next(3)

    const values: number[] = []
    subj.subscribe(v => values.push(v))

    expect(values).toEqual([1, 2, 3])
  })

  it("respects bufferSize", () => {
    const subj = new DietReplaySubject<number>(2)
    subj.next(1)
    subj.next(2)
    subj.next(3)

    const values: number[] = []
    subj.subscribe(v => values.push(v))

    expect(values).toEqual([2, 3])
  })

  it("complete() notifies observers and clears buffer, but subject stays alive", () => {
    const subj = new DietReplaySubject<number>()
    subj.next(1)
    subj.next(2)

    let completed = false
    const values1: number[] = []
    subj.subscribe({
      next: v => values1.push(v),
      complete: () => {
        completed = true
      },
    })

    expect(values1).toEqual([1, 2])

    subj.complete()
    expect(completed).toBe(true)
    expect(subj.buffer).toEqual([])
    expect(subj.observers.size).toBe(0)

    // Subject is still alive - new subscriber works
    subj.next(100)
    const values2: number[] = []
    subj.subscribe(v => values2.push(v))
    expect(values2).toEqual([100])

    subj.next(200)
    expect(values2).toEqual([100, 200])
  })

  it("error() notifies observers and clears buffer, but subject stays alive", () => {
    const subj = new DietReplaySubject<number>()
    subj.next(1)

    let receivedErr: unknown = null
    subj.subscribe({
      error: e => {
        receivedErr = e
      },
    })

    subj.error("boom")
    expect(receivedErr).toBe("boom")
    expect(subj.buffer).toEqual([])

    // Subject is still alive
    subj.next(42)
    const values: number[] = []
    subj.subscribe(v => values.push(v))
    expect(values).toEqual([42])
  })

  it("live subscribers receive new values after replay", () => {
    const subj = new DietReplaySubject<number>()
    subj.next(1)

    const values: number[] = []
    subj.subscribe(v => values.push(v))

    subj.next(2)
    subj.next(3)

    expect(values).toEqual([1, 2, 3])
  })
})

describe("dietShareRefCount", () => {
  it("shares single source subscription, multicasts values, resets on zero refcount", () => {
    let subscribeCount = 0
    let teardownCount = 0
    const source$ = new DietObservable<number>(observer => {
      subscribeCount++
      observer.next?.(100 * subscribeCount)
      return () => {
        teardownCount++
      }
    })

    const shared$ = source$.pipe(dietShareRefCount())
    const values1: number[] = []

    // First subscriber triggers source subscription
    const sub1 = shared$.subscribe(v => values1.push(v))
    expect(subscribeCount).toBe(1)
    expect(values1).toEqual([100])

    // Second subscriber joins, no new source subscription
    const sub2 = shared$.subscribe()
    expect(subscribeCount).toBe(1)

    sub1.unsubscribe()
    expect(teardownCount).toBe(0) // still has sub2

    sub2.unsubscribe()
    expect(teardownCount).toBe(1) // refcount zero, teardown called

    // New subscriber after zero refcount = fresh source subscription
    const values3: number[] = []
    const sub3 = shared$.subscribe(v => values3.push(v))
    expect(subscribeCount).toBe(2)
    expect(values3).toEqual([200])
    sub3.unsubscribe()
  })

  it("multicasts live values to all subscribers", () => {
    const subj = new DietSubject<number>()
    const shared$ = subj.pipe(dietShareRefCount())
    const values1: number[] = []
    const values2: number[] = []

    shared$.subscribe(v => values1.push(v))
    shared$.subscribe(v => values2.push(v))

    subj.next(1)
    subj.next(2)

    expect(values1).toEqual([1, 2])
    expect(values2).toEqual([1, 2])
  })

  it("propagates error and complete to all subscribers", () => {
    const subjErr = new DietSubject<number>()
    const sharedErr$ = subjErr.pipe(dietShareRefCount())
    const errors: unknown[] = []
    sharedErr$.subscribe({ error: e => errors.push(e) })
    sharedErr$.subscribe({ error: e => errors.push(e) })
    subjErr.error("boom")
    expect(errors).toEqual(["boom", "boom"])

    const subjComplete = new DietSubject<number>()
    const sharedComplete$ = subjComplete.pipe(dietShareRefCount())
    let completeCount = 0
    sharedComplete$.subscribe({ complete: () => completeCount++ })
    sharedComplete$.subscribe({ complete: () => completeCount++ })
    subjComplete.complete()
    expect(completeCount).toBe(2)
  })
})
