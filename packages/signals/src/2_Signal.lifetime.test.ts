import { Observable, type Subscription } from "rxjs"
import { map } from "rxjs"
import { describe, expect, it } from "vitest"
import { pipe$, Signal } from "./2_Signal"

describe("Signal source lifetime", () => {
  it("releases the source once every reader unsubscribes", () => {
    let active = 0
    const source = new Observable<number>(subscriber => {
      active += 1
      subscriber.next(7)
      return () => {
        active -= 1
      }
    })

    const signal = Signal(source, 0)
    const reader: Subscription = signal.$.subscribe(() => {})
    expect(reader.closed).toBe(false)
    expect(active).toBe(1)

    reader.unsubscribe()
    expect(active).toBe(0)
  })

  it("holds no source subscription before its first read", () => {
    let active = 0
    const source = new Observable<number>(subscriber => {
      active += 1
      subscriber.next(7)
      return () => {
        active -= 1
      }
    })

    const withDefault = Signal(source, 0)
    expect(active).withContext("two-arg overload stays cold before a read").toBe(0)
    const single = Signal(source)
    expect(active).withContext("single-arg overload stays cold before a read").toBe(0)
    void withDefault
    void single
  })

  it("a piped signal holds no source connection without readers", () => {
    let active = 0
    const source = new Observable<number>(subscriber => {
      active += 1
      subscriber.next(7)
      return () => {
        active -= 1
      }
    })

    const piped = pipe$(source, map(value => value + 1))
    expect(active).withContext("pipe$ stays cold before a read").toBe(0)

    const reader: Subscription = piped.$.subscribe(() => {})
    expect(active).toBe(1)
    reader.unsubscribe()
    expect(active).withContext("pipe$ releases the source with its last reader").toBe(0)
  })
})
