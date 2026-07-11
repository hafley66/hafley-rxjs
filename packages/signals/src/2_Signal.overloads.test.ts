import { Observable } from "rxjs"
import { describe, expect, expectTypeOf, it } from "vitest"
import { trackSubscription } from "../../../vitest.setup"
import { Signal } from "./2_Signal"

describe("Signal overload contract", () => {
  describe("Signal() — lazy shared event signal", () => {
    it("does not emit an initial undefined value", () => {
      const event = Signal<number>()
      const values: Array<number | undefined> = []

      trackSubscription(event.$.subscribe((value) => values.push(value)))

      expect(values).toEqual([])
    })

    it("does not replay an event to a late subscriber", () => {
      const event = Signal<number>()
      const first: Array<number | undefined> = []
      const second: Array<number | undefined> = []

      const firstSub = event.$.subscribe((value) => first.push(value))
      event.$(1)
      firstSub.unsubscribe()

      event.$(2)
      trackSubscription(event.$.subscribe((value) => second.push(value)))

      expect(first).toEqual([1])
      expect(second).toEqual([])
    })

    it("multicasts each event to current subscribers", () => {
      const event = Signal<number>()
      const first: Array<number | undefined> = []
      const second: Array<number | undefined> = []

      trackSubscription(event.$.subscribe((value) => first.push(value)))
      trackSubscription(event.$.subscribe((value) => second.push(value)))
      event.$(1)
      event.$(2)

      expect(first).toEqual([1, 2])
      expect(second).toEqual([1, 2])
    })
  })

  describe("Signal(data) — initialized writable state", () => {
    it("keeps synchronous read and replay semantics", () => {
      const count = Signal(1)
      const values: number[] = []

      expect(count.$()).toBe(1)
      trackSubscription(count.$.subscribe((value) => values.push(value)))
      count.$(2)

      expect(values).toEqual([1, 2])
      expect(count.$()).toBe(2)
    })
  })

  describe("Signal(observable$) — lazy shared replay-one state", () => {
    it("is undefined before the first source emission and types that possibility", () => {
      const source$ = new Observable<number>(() => undefined)
      const value = Signal(source$)

      expectTypeOf(value.$()).toEqualTypeOf<number | undefined>()
      expect(value.$()).toBeUndefined()
    })

    it("subscribes lazily, shares one source, and replays the latest value", () => {
      let subscriptions = 0
      let observer: { next(value: number): void } | undefined
      const source$ = new Observable<number>((subscriber) => {
        subscriptions++
        observer = subscriber
        return () => {
          observer = undefined
        }
      })
      const value = Signal(source$)

      expect(subscriptions).toBe(0)

      const first: Array<number | undefined> = []
      const second: Array<number | undefined> = []
      const firstSub = value.$.subscribe((next) => first.push(next))
      expect(subscriptions).toBe(1)

      observer?.next(1)
      const secondSub = value.$.subscribe((next) => second.push(next))

      expect(subscriptions).toBe(1)
      expect(first).toEqual([1])
      expect(second).toEqual([1])

      firstSub.unsubscribe()
      secondSub.unsubscribe()
    })

    it("releases the source when the last subscriber leaves", () => {
      let activeSubscriptions = 0
      const source$ = new Observable<number>(() => {
        activeSubscriptions++
        return () => {
          activeSubscriptions--
        }
      })
      const value = Signal(source$)

      const first = value.$.subscribe()
      const second = value.$.subscribe()
      expect(activeSubscriptions).toBe(1)

      first.unsubscribe()
      expect(activeSubscriptions).toBe(1)
      second.unsubscribe()
      expect(activeSubscriptions).toBe(0)
    })

    it("allows local writes until the external source overwrites them", () => {
      let sourceNext: ((value: number) => void) | undefined
      const value = Signal(new Observable<number>(subscriber => {
        sourceNext = next => subscriber.next(next)
      }), 0)
      const seen: number[] = []
      trackSubscription(value.$.subscribe(next => seen.push(next)))

      value.$(1)
      expect(value.$()).toBe(1)
      sourceNext?.(2)

      expect(value.$()).toBe(2)
      expect(seen).toEqual([0, 1, 2])
    })
  })

  describe("Signal(observable$, defaultValue) — initialized lazy state", () => {
    it("uses the default synchronously and preserves exact T", () => {
      const source$ = new Observable<number>(() => undefined)
      const value = Signal(source$, 42)

      expectTypeOf(value.$()).toEqualTypeOf<number>()
      expect(value.$()).toBe(42)
    })

    it("does not subscribe to the source merely to provide the default", () => {
      let subscriptions = 0
      const source$ = new Observable<number>(() => {
        subscriptions++
      })
      const value = Signal(source$, 42)

      expect(value.$()).toBe(42)
      expect(subscriptions).toBe(0)

      const sub = value.$.subscribe()
      expect(subscriptions).toBe(1)
      sub.unsubscribe()
    })
  })
})
