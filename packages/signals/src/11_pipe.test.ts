import { describe, expect, it } from "vitest"
import { debounceTime, filter, map, scan, Subject } from "rxjs"
import { trackSubscription } from "../../../vitest.setup"
import { pipe$, Signal } from "./2_Signal"

describe("pipe$", () => {
  it("wraps a synchronous pipeline into a signal a reader can read", () => {
    const s = Signal({ n: 2 })
    const doubled = s.n.$.pipe$(map((n) => n * 2))
    expect(doubled.$()).toBeUndefined()
    trackSubscription(doubled.$.subscribe(() => {}))
    expect(doubled.$()).toBe(4)
    s.n.$(5)
    expect(doubled.$()).toBe(10)
  })

  it("reads undefined until the first emission when the pipeline defers", () => {
    const s = Signal({ n: 1 })
    const late = s.n.$.pipe$(debounceTime(50))
    expect(late.$()).toBeUndefined()
  })

  it("keeps proxy dots, so a derived object is still a tree", () => {
    const s = Signal({ n: 1 })
    const wrapped = s.n.$.pipe$(map((n) => ({ doubled: n * 2, half: n / 2 })))
    trackSubscription(wrapped.$.subscribe(() => {}))
    expect(wrapped.doubled.$()).toBe(2)
    s.n.$(4)
    expect(wrapped.doubled.$()).toBe(8)
  })

  it("inherits the distinction slot, so a sibling write does not re-emit downstream", () => {
    const s = Signal({ a: 1, b: 1 })
    const seen: number[] = []
    const derived = s.a.$.pipe$(map((n) => n * 10))
    trackSubscription(derived.$.subscribe((v) => seen.push(v)))

    s.b.$(2)
    expect(seen).toEqual([10])

    s.a.$(3)
    expect(seen).toEqual([10, 30])
  })

  it("composes operators that drop values", () => {
    const s = Signal({ n: 1 })
    const evens = s.n.$.pipe$(filter((n) => n % 2 === 0))
    expect(evens.$()).toBeUndefined()
    trackSubscription(evens.$.subscribe(() => {}))
    s.n.$(4)
    expect(evens.$()).toBe(4)
  })

  it("carries state across emissions when the operator does", () => {
    const s = Signal({ n: 1 })
    const running = s.n.$.pipe$(scan((total, n) => total + n, 0))
    trackSubscription(running.$.subscribe(() => {}))
    s.n.$(2)
    s.n.$(3)
    expect(running.$()).toBe(6)
  })

  it("takes ten operators", () => {
    const s = Signal({ n: 0 })
    const out = s.n.$.pipe$(
      map((n) => n + 1), map((n) => n + 1), map((n) => n + 1), map((n) => n + 1), map((n) => n + 1),
      map((n) => n + 1), map((n) => n + 1), map((n) => n + 1), map((n) => n + 1), map((n) => n + 1),
    )
    trackSubscription(out.$.subscribe(() => {}))
    expect(out.$()).toBe(10)
  })
})

describe("pipe$ as a free function", () => {
  it("turns an observable into a signal and continues the pipeline in one declaration", () => {
    const src = new Subject<number>()
    const total = pipe$(src, filter((n) => n > 0), scan((sum, n) => sum + n, 0))
    trackSubscription(total.$.subscribe(() => {}))
    src.next(3)
    src.next(-1)
    src.next(4)
    expect(total.$()).toBe(7)
  })

  it("takes an existing signal as the source", () => {
    const s = Signal({ n: 2 })
    const out = pipe$(s.n, map((n) => n * 3))
    trackSubscription(out.$.subscribe(() => {}))
    expect(out.$()).toBe(6)
    s.n.$(5)
    expect(out.$()).toBe(15)
  })
})
