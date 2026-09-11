// Chromium under `vitest.browser.config.ts` supplies the elements. The IntersectionObserver is
// stubbed over, the same way `src/14_measure.test.ts` stubs it: a real one delivers its entries a
// frame later and publishes neither its instance count nor its targets, and both are what these
// tests assert.
import { afterEach, beforeEach, describe, expect, test } from "vitest"
import { Observable } from "rxjs"
import { DEFAULT_BUFFER_PX } from "./14_measure.js"
import { mountInView, runWhenInView } from "./17_in_view.js"

type StubEntry = { readonly target: Element; readonly isIntersecting: boolean }

class IntersectionObserverStub {
  static live: IntersectionObserverStub[] = []
  static disconnected = 0
  readonly targets = new Set<Element>()
  constructor(
    private readonly notify: (entries: readonly StubEntry[]) => void,
    readonly options: IntersectionObserverInit | undefined,
  ) {
    IntersectionObserverStub.live.push(this)
  }
  observe(target: Element): void {
    this.targets.add(target)
  }
  unobserve(target: Element): void {
    this.targets.delete(target)
  }
  disconnect(): void {
    IntersectionObserverStub.disconnected++
    this.targets.clear()
  }
  emit(entries: readonly StubEntry[]): void {
    this.notify(entries)
  }
}

globalThis.IntersectionObserver = IntersectionObserverStub as unknown as typeof IntersectionObserver

const observer = (): IntersectionObserverStub => {
  const found = IntersectionObserverStub.live[IntersectionObserverStub.live.length - 1]
  if (found === undefined) throw new Error("no IntersectionObserver was constructed")
  return found
}

const cross = (host: HTMLElement, near: boolean): void => {
  observer().emit([{ target: host, isIntersecting: near }])
}

interface Counted {
  readonly source: Observable<number>
  readonly runs: () => number
  readonly stops: () => number
}

/** Cold and counted, so "did it run" is a number rather than a side effect to go looking for. */
const counted = (): Counted => {
  let runs = 0
  let stops = 0
  const source = new Observable<number>((subscriber) => {
    runs++
    subscriber.next(runs)
    return () => {
      stops++
    }
  })
  return { source, runs: () => runs, stops: () => stops }
}

const hostOf = (): HTMLElement => {
  const el = document.createElement("div")
  document.body.append(el)
  return el
}

const hosts: HTMLElement[] = []

beforeEach(() => {
  IntersectionObserverStub.live = []
  IntersectionObserverStub.disconnected = 0
})

afterEach(() => {
  for (const host of hosts) host.remove()
  hosts.length = 0
})

const host = (): HTMLElement => {
  const el = hostOf()
  hosts.push(el)
  return el
}

describe("a source runs only while its host is in view", () => {
  test("a source does not run while its host is out of view", () => {
    const el = host()
    const seen = counted()
    const stop = mountInView(el, () => runWhenInView(seen.source))
    expect(seen.runs()).toBe(0)
    cross(el, false)
    expect(seen.runs()).toBe(0)
    stop()
  })

  test("it starts when the host enters the buffer zone, before the host is visible", () => {
    const el = host()
    const seen = counted()
    const stop = mountInView(el, () => runWhenInView(seen.source))
    // The margin is what makes the crossing early: a host still under the fold by less than the
    // buffer is what a real observer reports as intersecting, which is the emission below.
    expect(observer().options?.rootMargin).toBe(`${DEFAULT_BUFFER_PX}px 0px`)
    cross(el, true)
    expect(seen.runs()).toBe(1)
    stop()
  })

  test("it stops when the host leaves, and starts again when the host returns", () => {
    const el = host()
    const seen = counted()
    const stop = mountInView(el, () => runWhenInView(seen.source))
    cross(el, true)
    cross(el, false)
    expect(seen.stops()).toBe(1)
    cross(el, true)
    expect(seen.runs()).toBe(2)
    stop()
  })

  test("the effect receives every value the source emits while the host is in view", () => {
    const el = host()
    const seen = counted()
    const values: number[] = []
    const stop = mountInView(el, () => runWhenInView(seen.source, (it) => values.push(it)))
    cross(el, true)
    cross(el, false)
    cross(el, true)
    expect(values).toEqual([1, 2])
    stop()
  })
})

describe("the observer is shared and released", () => {
  test("two runners on one host take one observation, and teardown releases it", () => {
    const el = host()
    const first = mountInView(el, () => runWhenInView(counted().source))
    const second = mountInView(el, () => runWhenInView(counted().source))
    expect(IntersectionObserverStub.live.length).toBe(1)
    expect(observer().targets.size).toBe(1)
    first()
    expect(observer().targets.has(el)).toBe(true)
    second()
    expect(observer().targets.has(el)).toBe(false)
  })

  test("teardown removes the host from the shared observer, and the last teardown disconnects it", () => {
    const one = host()
    const other = host()
    const first = mountInView(one, () => runWhenInView(counted().source))
    const second = mountInView(other, () => runWhenInView(counted().source))
    expect(IntersectionObserverStub.live.length).toBe(1)
    expect(observer().targets.size).toBe(2)
    first()
    expect(observer().targets.size).toBe(1)
    expect(IntersectionObserverStub.disconnected).toBe(0)
    second()
    expect(IntersectionObserverStub.disconnected).toBe(1)
  })

  test("two demos on one page have independent lifetimes", () => {
    const one = host()
    const other = host()
    const left = counted()
    const right = counted()
    const stopLeft = mountInView(one, () => runWhenInView(left.source))
    const stopRight = mountInView(other, () => runWhenInView(right.source))
    cross(one, true)
    expect(left.runs()).toBe(1)
    expect(right.runs()).toBe(0)
    cross(other, true)
    cross(one, false)
    expect(left.stops()).toBe(1)
    expect(right.stops()).toBe(0)
    stopLeft()
    stopRight()
  })
})

describe("the host comes from the mount", () => {
  test("a call with no mount around it names mountInView rather than guessing a host", () => {
    expect(() => runWhenInView(counted().source)).toThrow(/mountInView/)
  })

  test("a nested mount restores the host it replaced", () => {
    const outer = host()
    const inner = host()
    const seen = counted()
    const stop = mountInView(outer, () => {
      mountInView(inner, () => runWhenInView(counted().source))()
      return runWhenInView(seen.source)
    })
    cross(outer, true)
    expect(seen.runs()).toBe(1)
    stop()
  })
})
