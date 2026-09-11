import { EMPTY, Observable, Subject, of, timer } from "rxjs"
import { map } from "rxjs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { trackSubscription } from "../../../vitest.setup"
import { Signal } from "./2_Signal"

describe("Signal(fn(prev), initial): scan form", () => {
  it("dispatches on arity: one parameter is scan, zero is memo", () => {
    const step = Signal(1)
    const memo = Signal(() => step.$() * 10)
    const count = Signal((prev: number) => prev + step.$(), 0)

    expect(memo.$()).toBe(10)
    expect(count.$()).toBe(1)
  })

  it("receives its own previous value on every dependency change", () => {
    const step = Signal(1)
    const count = Signal((prev: number) => prev + step.$(), 0)
    const values: number[] = []

    trackSubscription(count.$.subscribe((value) => values.push(value)))
    step.$(1)
    step.$(5)

    expect(values).toEqual([1, 2, 7])
    expect(count.$()).toBe(7)
  })

  it("keeps its value as prev across a resubscribe, like a memo keeps its value", () => {
    const step = Signal(1)
    const count = Signal((prev: number) => prev + step.$(), 0)

    const first: number[] = []
    const sub = count.$.subscribe((value) => first.push(value))
    step.$(2)
    sub.unsubscribe()

    const second: number[] = []
    trackSubscription(count.$.subscribe((value) => second.push(value)))

    expect(first).toEqual([1, 3])
    expect(second).toEqual([5])
  })
})

describe("Signal(fn(prev), seed): writes feed prev by default", () => {
  it("a write becomes the value and the next run's prev", () => {
    const step = Signal(1)
    const count = Signal((prev: number) => prev + step.$(), 0)
    const values: number[] = []

    trackSubscription(count.$.subscribe((value) => values.push(value)))
    count.$(10)
    step.$(5)

    expect(values).toEqual([1, 10, 15])
    expect(count.$()).toBe(15)
  })

  it("writable: false keeps a write out of prev", () => {
    const step = Signal(1)
    const count = Signal((prev: number) => prev + step.$(), 0, { writable: false })

    trackSubscription(count.$.subscribe())
    count.$(10)
    step.$(5)

    expect(count.$()).toBe(6)
  })
})

describe("Signal(fn(prev), initial): expand form", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("feeds each inner emission as the value and reruns the body on completion", () => {
    const seen: number[] = []
    const loop = Signal((prev: number) => (prev >= 3 ? EMPTY : of(prev + 1)), 0)

    trackSubscription(loop.$.subscribe((value) => seen.push(value)))

    expect(seen).toEqual([1, 2, 3])
    expect(loop.$()).toBe(3)
  })

  it("polls with exhaust semantics: the next request waits for the previous reply", () => {
    let inFlight = 0
    let started = 0
    const request = () =>
      new Observable<number>((subscriber) => {
        inFlight++
        started++
        const handle = setTimeout(() => {
          inFlight--
          subscriber.next(started)
          subscriber.complete()
        }, 5000)
        return () => clearTimeout(handle)
      })
    const graph = Signal(
      (prev: number | undefined) => timer(prev === undefined ? 0 : 3000).pipe(map(() => request())).pipe(
        (source) => new Observable<number>((subscriber) => {
          const outer = source.subscribe((inner) => inner.subscribe(subscriber))
          return () => outer.unsubscribe()
        }),
      ),
      undefined as number | undefined,
    )
    const seen: Array<number | undefined> = []

    trackSubscription(graph.$.subscribe((value) => seen.push(value)))
    vi.advanceTimersByTime(0)
    expect(started).toBe(1)
    vi.advanceTimersByTime(4000)
    expect(started).toBe(1)
    expect(inFlight).toBe(1)
    vi.advanceTimersByTime(1000)
    expect(seen).toEqual([undefined, 1])
    vi.advanceTimersByTime(3000)
    expect(started).toBe(2)
    vi.advanceTimersByTime(5000)
    expect(seen).toEqual([undefined, 1, 2])
  })

  it("settles when the inner completes without emitting", () => {
    let runs = 0
    const loop = Signal((prev: number) => {
      runs++
      return EMPTY
    }, 0)

    trackSubscription(loop.$.subscribe())
    vi.advanceTimersByTime(10_000)

    expect(runs).toBe(1)
  })

  it("cancels the inner stream and reruns when a dependency changes", () => {
    const source = Signal("a")
    const cancelled: string[] = []
    const inner = new Subject<string>()
    const derived = Signal((prev: string) => {
      const key = source.$()
      return new Observable<string>((subscriber) => {
        const sub = inner.pipe(map((value) => `${key}:${value}`)).subscribe(subscriber)
        return () => {
          cancelled.push(key)
          sub.unsubscribe()
        }
      })
    }, "")
    const seen: string[] = []

    trackSubscription(derived.$.subscribe((value) => seen.push(value)))
    inner.next("1")
    source.$("b")
    inner.next("2")

    expect(cancelled).toEqual(["a"])
    expect(seen).toEqual(["", "a:1", "b:2"])
  })

  it("accepts a promise as the body result", async () => {
    vi.useRealTimers()
    const loop = Signal((prev: number) => (prev >= 2 ? EMPTY : Promise.resolve(prev + 1)), 0)
    const seen: number[] = []

    trackSubscription(loop.$.subscribe((value) => seen.push(value)))
    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(seen).toEqual([0, 1, 2])
  })

  it("stops the loop when the subscriber leaves", () => {
    let started = 0
    const loop = Signal(
      (prev: number) =>
        new Observable<number>((subscriber) => {
          started++
          const handle = setTimeout(() => {
            subscriber.next(prev + 1)
            subscriber.complete()
          }, 1000)
          return () => clearTimeout(handle)
        }),
      0,
    )

    const sub = loop.$.subscribe()
    vi.advanceTimersByTime(2500)
    sub.unsubscribe()
    vi.advanceTimersByTime(10_000)

    expect(started).toBe(3)
  })
})
