import { Observable } from "rxjs"
import { describe, expect, expectTypeOf, it } from "vitest"
import { trackSubscription } from "../../../vitest.setup"
import { Signal } from "./2_Signal"

describe("Signal(fn) — automatic computed contract", () => {
  it("returns the computed value rather than the function", () => {
    const count = Signal(2)
    const doubled = Signal(() => count.$() * 2)

    expectTypeOf(doubled.$()).toEqualTypeOf<number>()
    expect(doubled.$()).toBe(4)
  })

  it("recomputes when a synchronously read dependency changes", () => {
    const count = Signal(2)
    const doubled = Signal(() => count.$() * 2)
    const values: number[] = []

    trackSubscription(doubled.$.subscribe((value) => values.push(value)))
    count.$(3)

    expect(values).toEqual([4, 6])
    expect(doubled.$()).toBe(6)
  })

  it("is lazy and memoized while it has no readers", () => {
    const count = Signal(2)
    let computations = 0
    const doubled = Signal(() => {
      computations++
      return count.$() * 2
    })

    expect(computations).toBe(0)
    expect(doubled.$()).toBe(4)
    expect(computations).toBe(1)
    expect(doubled.$()).toBe(4)
    expect(computations).toBe(1)
  })

  it("deduplicates repeated reads of the same dependency", () => {
    const count = Signal(2)
    let computations = 0
    const tripled = Signal(() => {
      computations++
      return count.$() + count.$() + count.$()
    })

    const values: number[] = []
    trackSubscription(tripled.$.subscribe((value) => values.push(value)))
    expect(computations).toBe(1)

    count.$(3)

    expect(computations).toBe(2)
    expect(values).toEqual([6, 9])
  })

  it("dynamically replaces dependencies when a branch changes", () => {
    const useLeft = Signal(true)
    const left = Signal(1)
    const right = Signal(10)
    const selected = Signal(() => useLeft.$() ? left.$() : right.$())
    const values: number[] = []

    trackSubscription(selected.$.subscribe((value) => values.push(value)))
    left.$(2)
    right.$(11) // inactive dependency: no recomputation
    useLeft.$(false)
    left.$(3) // removed dependency: no recomputation
    right.$(12)

    expect(values).toEqual([1, 2, 11, 12])
  })

  it("composes nested memos without requiring combineLatest", () => {
    const price = Signal(5)
    const quantity = Signal(2)
    const subtotal = Signal(() => price.$() * quantity.$())
    const total = Signal(() => subtotal.$() * 1.1)
    const values: number[] = []

    trackSubscription(total.$.subscribe((value) => values.push(value)))
    quantity.$(3)

    expect(values).toEqual([11, 16.5])
  })

  it("shares one memo computation across concurrent subscribers", () => {
    const count = Signal(1)
    let computations = 0
    const doubled = Signal(() => {
      computations++
      return count.$() * 2
    })
    const first: number[] = []
    const second: number[] = []

    const firstSub = doubled.$.subscribe((value) => first.push(value))
    const secondSub = doubled.$.subscribe((value) => second.push(value))
    expect(computations).toBe(1)

    count.$(2)

    expect(computations).toBe(2)
    expect(first).toEqual([2, 4])
    expect(second).toEqual([2, 4])

    firstSub.unsubscribe()
    secondSub.unsubscribe()
  })

  it("unsubscribes from observable-backed dependencies when unused", () => {
    let activeSubscriptions = 0
    const source$ = new Observable<number>(() => {
      activeSubscriptions++
      return () => {
        activeSubscriptions--
      }
    })
    const source = Signal(source$, 1)
    const doubled = Signal(() => source.$() * 2)

    expect(activeSubscriptions).toBe(0)
    const sub = doubled.$.subscribe()
    expect(activeSubscriptions).toBe(1)

    sub.unsubscribe()
    expect(activeSubscriptions).toBe(0)
  })

  it("recomputes a diamond's join once per root write", () => {
    const root = Signal(1)
    const left = Signal(() => root.$() * 10)
    const right = Signal(() => root.$() * 100)
    let computations = 0
    const join = Signal(() => {
      computations++
      return left.$() + right.$()
    })
    const values: number[] = []

    trackSubscription(join.$.subscribe((value) => values.push(value)))
    root.$(2)

    expect(computations).toBe(2)
    expect(values).toEqual([110, 220])
  })

  it("flushes an input before the memo that pulls it, whatever order they wired in", () => {
    const root = Signal(1)
    const viaMemo = Signal(false)
    const tenfold = Signal(() => root.$() * 10)
    let computations = 0
    const sum = Signal(() => {
      computations++
      return viaMemo.$() ? root.$() + tenfold.$() : root.$()
    })
    const values: number[] = []

    trackSubscription(sum.$.subscribe((value) => values.push(value)))
    viaMemo.$(true)
    computations = 0
    root.$(2)

    expect(computations).toBe(1)
    expect(values).toEqual([1, 11, 22])
  })

  it("releases a torn-down consumer from its source, reads included", () => {
    const rows = Signal([1, 2, 3])
    const observersOnRows = () => (rows.$ as unknown as { observers: unknown[] }).observers.length
    const start = observersOnRows()
    const teardowns = [1, 2, 3].map(() => {
      const sorted = Signal(() => [...rows.$()].sort())
      const flat = Signal(() => sorted.$().length)
      const binding = flat.$.subscribe(() => {})
      sorted.$()
      return () => binding.unsubscribe()
    })

    expect(observersOnRows()).toBe(start + 3)
    for (const teardown of teardowns) teardown()

    expect(observersOnRows()).toBe(start)
  })

  it("does not permanently kill the memo after a computation throws", () => {
    const shouldThrow = Signal(false)
    const count = Signal(1)
    const computed = Signal(() => {
      if (shouldThrow.$()) throw new Error("boom")
      return count.$()
    })
    const values: number[] = []
    const errors: unknown[] = []

    trackSubscription(computed.$.subscribe({
      next: (value) => values.push(value),
      error: (error) => errors.push(error),
    }))

    shouldThrow.$(true)
    shouldThrow.$(false)
    count.$(2)

    expect(errors).toHaveLength(0)
    expect(values).toEqual([1, 1, 2])
  })
})
