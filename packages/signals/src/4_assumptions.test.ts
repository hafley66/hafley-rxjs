import { describe, it, expect } from 'vitest'
import { Signal } from './2_Signal'
import { trackSubscription } from '../../../vitest.setup'

/**
 * Behavioral assumptions derived from a code review of 1_SignalCreator.ts.
 * Each test title names the assumption. Assertions match ACTUAL observed
 * behavior. Where observed behavior contradicts the predicted assumption the
 * assertion is written to reality and the divergence is called out in a
 * trailing comment (REFUTED).
 */

describe('assumptions: SignalCreator', () => {
  // A. No dedupe on scoped selectors: a sibling write re-emits the unchanged
  //    value to a scoped subscriber (map + shareReplay, no distinctUntilChanged).
  it('A: scoped selector re-emits unchanged value on a sibling write (no dedupe)', () => {
    const state = Signal({ a: 1, b: 1 })
    const emissions: number[] = []

    trackSubscription(state.a.$.subscribe((v) => emissions.push(v)))
    expect(emissions).toEqual([1]) // synchronous replay of current value

    state.b.$(2) // write a SIBLING path

    // CONFIRMED: the `a` subscriber sees a second emission of the unchanged 1.
    expect(emissions).toEqual([1, 1])
  })

  // B. Writing an identical value re-emits (setter has no Object.is guard).
  it('B: writing an identical nested value re-emits to subscribers', () => {
    const state = Signal({ a: 1 })
    const emissions: number[] = []

    trackSubscription(state.a.$.subscribe((v) => emissions.push(v)))
    expect(emissions).toEqual([1])

    state.a.$(1) // identical value

    // CONFIRMED: no equality guard, so it emits again.
    expect(emissions).toEqual([1, 1])
  })

  it('B: writing the identical root object re-emits (BehaviorSubject.next has no guard)', () => {
    const obj = { a: 1 }
    const state = Signal(obj)
    const emissions: unknown[] = []

    trackSubscription(state.$.subscribe((v) => emissions.push(v)))
    expect(emissions).toEqual([obj])

    state.$(obj) // same object reference

    // CONFIRMED: root setter calls state$.next(obj); BehaviorSubject re-emits.
    expect(emissions).toHaveLength(2)
    expect(emissions[0]).toBe(obj)
    expect(emissions[1]).toBe(obj)
  })

  // C. Per-method shareReplay duplication: each BS/Observable method name accessed
  //    on `$` lazily builds and caches its OWN scoped autoSelector$ (own shareReplay).
  it('C: .pipe() returns the same cached Observable instance on repeated access', () => {
    const state = Signal({ a: 1 })

    const first = state.a.$.pipe()
    const second = state.a.$.pipe()

    // CONFIRMED (cache half): the bound `pipe` is cached, and pipe() with no
    // operators returns its source (the cached autoSelector$).
    expect(first).toBe(second)
    expect(typeof first.subscribe).toBe('function')
  })

  it('C: a different method access (.lift) builds a DISTINCT autoSelector$ from .pipe', () => {
    const state = Signal({ a: 1 })

    const pipeSource = state.a.$.pipe() // autoSelector$ built during `.pipe` access
    // `.lift` is built during a separate property access -> its own autoSelector$.
    const lifted = (state.a.$ as unknown as {
      lift: (op: (s: unknown) => unknown) => { source: unknown }
    }).lift((s) => s)

    // CONFIRMED (duplication half): the observable backing `.lift` is a different
    // instance from the one backing `.pipe`.
    expect(lifted.source).toBeDefined()
    expect(lifted.source).not.toBe(pipeSource)
  })

  // D. Child proxy identity is stable and cached forever.
  it('D: sibling and indexed child proxies are referentially stable (cached)', () => {
    const state = Signal({ a: 1, list: [1, 2, 3] })

    expect(state.a).toBe(state.a)
    expect(state.list[3]).toBe(state.list[3]) // index beyond current length still cached
  })

  it('D: an index node beyond the shrunk array length persists and reads undefined', () => {
    const state = Signal({ list: [1, 2, 3, 4, 5, 6] })

    const n5 = state.list[5]
    expect(n5.$()).toBe(6)

    state.list.$([1, 2, 3]) // shrink the array

    // CONFIRMED: same cached proxy instance, now reading undefined.
    expect(state.list[5]).toBe(n5)
    expect(n5.$()).toBeUndefined()
  })

  // E. Array method interception.
  it('E: state.list.push(4) throws; the interception path is state.list.push.$()(4)', () => {
    const state = Signal({ list: [1, 2, 3] })

    // REFUTED (as literally stated): `.push` resolves to a child proxy OBJECT,
    // not a callable, so direct invocation throws.
    expect(typeof (state as unknown as { list: { push: unknown } }).list.push).toBe('object')
    expect(() => (state.list as unknown as { push: (n: number) => number }).push(4)).toThrow(
      /is not a function/,
    )

    // The actual interception path: call the wrapped method returned by `.$()`.
    const emissions: number[][] = []
    trackSubscription(state.list.$.subscribe((v) => emissions.push([...(v as number[])])))
    expect(emissions).toEqual([[1, 2, 3]])

    const pushFn = (state.list.push.$ as unknown as () => (n: number) => number)()
    const ret = pushFn(4)

    // CONFIRMED: mutation applied, state updated + emitted, return is new length.
    expect(ret).toBe(4)
    expect(state.list.$()).toEqual([1, 2, 3, 4])
    expect(emissions).toEqual([
      [1, 2, 3],
      [1, 2, 3, 4],
    ])
  })

  it('E: a non-mutating array method (.map) does not emit', () => {
    const state = Signal({ list: [1, 2, 3] })

    const emissions: number[][] = []
    trackSubscription(state.list.$.subscribe((v) => emissions.push([...(v as number[])])))
    expect(emissions).toEqual([[1, 2, 3]])

    const mapFn = (state.list.map.$ as unknown as () => (f: (x: number) => number) => number[])()
    const mapped = mapFn((x) => x)

    // CONFIRMED: map returns a plain array and produces no state emission
    // (produce() output isEqual the source, so no .next()).
    expect(mapped).toEqual([1, 2, 3])
    expect(emissions).toEqual([[1, 2, 3]])
  })
})
