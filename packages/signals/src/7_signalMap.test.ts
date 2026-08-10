import { of, Subject } from "rxjs"
import { describe, expect, it } from "vitest"
import { trackSubscription } from "../../../vitest.setup"
import { Signal } from "./2_Signal"
import { signalMap } from "./7_signalMap"

describe("signalMap — pipe operator", () => {
  it("projects the source emission and re-emits when a read signal changes", () => {
    const global = Signal(2)
    const values: number[] = []

    trackSubscription(
      of(1).pipe(signalMap((n) => n + global.$())).subscribe((v) => values.push(v)),
    )

    expect(values).toEqual([3])
    global.$(4)
    expect(values).toEqual([3, 5])
  })

  it("does not re-emit for a signal the projection did not read", () => {
    const read = Signal(1)
    const unread = Signal(10)
    const values: number[] = []

    trackSubscription(
      of(1).pipe(signalMap((n) => n + read.$())).subscribe((v) => values.push(v)),
    )

    unread.$(99)
    expect(values).toEqual([2])
    read.$(2)
    expect(values).toEqual([2, 3])
  })

  it("swaps which signal it tracks when a branch dependency changes", () => {
    const useLeft = Signal(true)
    const left = Signal(1)
    const right = Signal(10)
    const values: number[] = []

    trackSubscription(
      of(0).pipe(signalMap(() => (useLeft.$() ? left.$() : right.$()))).subscribe((v) => values.push(v)),
    )

    left.$(2)
    right.$(11)
    useLeft.$(false)
    left.$(3)
    right.$(12)

    expect(values).toEqual([1, 2, 11, 12])
  })

  it("stays open when the source completes and keeps re-emitting on signal change", () => {
    const global = Signal(2)
    let completed = false
    const values: number[] = []

    trackSubscription(
      of(1).pipe(signalMap((n) => n + global.$())).subscribe({
        next: (v) => values.push(v),
        complete: () => { completed = true },
      }),
    )

    expect(completed).toBe(false)
    global.$(4)
    global.$(6)

    expect(values).toEqual([3, 5, 7])
    expect(completed).toBe(false)
  })

  it("recombines when any of several read signals changes", () => {
    const a = Signal(1)
    const b = Signal(10)
    const values: number[] = []

    trackSubscription(
      of(1).pipe(signalMap((n) => n + a.$() + b.$())).subscribe((v) => values.push(v)),
    )

    a.$(2)
    b.$(20)

    expect(values).toEqual([12, 13, 23])
  })

  it("keeps the last output across a transient projection error and recovers", () => {
    const shouldThrow = Signal(false)
    const count = Signal(1)
    const values: number[] = []
    const errors: unknown[] = []

    trackSubscription(
      of(1).pipe(
        signalMap((n) => {
          if (shouldThrow.$()) throw new Error("boom")
          return n + count.$()
        }),
      ).subscribe({
        next: (v) => values.push(v),
        error: (e) => errors.push(e),
      }),
    )

    shouldThrow.$(true)
    shouldThrow.$(false)
    count.$(5)

    expect(errors).toHaveLength(0)
    expect(values).toEqual([2, 2, 6])
  })

  it("re-derives on each source emission and on signal change against the latest source", () => {
    const multiplier = Signal(10)
    const source$ = new Subject<number>()
    const out: number[] = []

    trackSubscription(
      source$.pipe(signalMap((n) => n * multiplier.$())).subscribe((v) => out.push(v)),
    )

    source$.next(1)            // 1 * 10
    source$.next(2)            // 2 * 10
    multiplier.$(100)          // 2 * 100 (last source value)
    source$.next(3)            // 3 * 100

    expect(out).toEqual([10, 20, 200, 300])
  })

  it("stops re-emitting after the consumer tears down the subscription", () => {
    const count = Signal(0)
    const source$ = new Subject<string>()

    const out: string[] = []
    const sub = source$.pipe(signalMap((s) => `${s}:${count.$()}`)).subscribe((v) => out.push(v))

    source$.next("a")          // a:0
    sub.unsubscribe()
    count.$(5)
    source$.next("b")

    expect(out).toEqual(["a:0"])
  })

  it("drives a derived display that swaps format on a UI signal change", () => {
    const compact = Signal(true)
    const source$ = new Subject<{ id: number }>()
    const out: string[] = []

    trackSubscription(
      source$
        .pipe(signalMap((v) => (compact.$() ? `#${v.id}` : `item-${v.id}`)))
        .subscribe((v) => out.push(v)),
    )

    source$.next({ id: 1 })    // #1
    compact.$(false)           // item-1 (re-derive against last source)
    source$.next({ id: 2 })    // item-2
    compact.$(true)            // #2

    expect(out).toEqual(["#1", "item-1", "item-2", "#2"])
  })
})
