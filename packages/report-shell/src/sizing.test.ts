import { describe, expect, it } from 'vitest'
import type { Storage } from '@hafley66/signals'
import { createSizingStore } from './sizing'

// Minimal in-memory Storage<string>: a shared cell, read synchronously on subscribe like
// localStorageAdapter's initial emit, no cross-instance push (same-tab writes do not
// self-notify on real localStorage either, so this matches that shape).
function createMemoryStorage(): Storage<string> {
  let value = ''
  const read = {
    subscribe(next: (value: string) => void) {
      next(value)
      return { unsubscribe: () => {} }
    },
  } as unknown as Storage<string>['read']

  return {
    read,
    write: {
      next: (next: string) => {
        value = next
      },
      error() {},
      complete() {},
    },
  }
}

describe('createSizingStore', () => {
  it('records then restores at the same viewport unchanged', () => {
    const store = createSizingStore(createMemoryStorage())
    store.record('nav', 200, 1000)
    store.record('main', 800, 1000)
    const result = store.restore(['nav', 'main'], 1000, { nav: 100, main: 100 })
    expect(result).toEqual({ nav: 200, main: 800 })
  })

  it('scales manual ids by share at 1.5x viewport and clamps to mins', () => {
    const store = createSizingStore(createMemoryStorage())
    store.record('nav', 200, 1000, true)
    store.record('detail', 40, 1000, true)
    // 'filler' is an untracked auto id so the manual math is visible without growToFill
    // (step 3) reassigning the rest of the viewport onto a manual id.
    const result = store.restore(['nav', 'detail', 'filler'], 1500, { nav: 100, detail: 80, filler: 0 })
    expect(result.nav).toBe(300)
    expect(result.detail).toBe(80)
  })

  it('shrinks lowest priority first at 0.5x viewport and never below mins', () => {
    const store = createSizingStore(createMemoryStorage())
    store.record('nav', 300, 1000, true) // share 0.3
    store.record('detail', 540, 600, true) // share 0.9, overlaps nav's share at a smaller viewport
    const result = store.restore(['nav', 'detail'], 500, { nav: 60, detail: 60 }, ['nav'])
    expect(result.nav).toBe(150)
    expect(result.detail).toBe(350)
    expect(result.nav + result.detail).toBe(500)
    expect(result.nav).toBeGreaterThanOrEqual(60)
    expect(result.detail).toBeGreaterThanOrEqual(60)
  })

  it('shares the remainder equally across auto ids with no history', () => {
    const store = createSizingStore(createMemoryStorage())
    const result = store.restore(['a', 'b', 'c'], 900, { a: 0, b: 0, c: 0 })
    expect(result).toEqual({ a: 300, b: 300, c: 300 })
  })

  it('flips isManual with the manual flag', () => {
    const store = createSizingStore(createMemoryStorage())
    store.record('nav', 200, 1000, true)
    expect(store.isManual('nav')).toBe(true)
    store.record('nav', 200, 1000, false)
    expect(store.isManual('nav')).toBe(false)
    expect(store.isManual('unseen')).toBe(false)
  })

  it('clear(id) drops one record, clear() drops all', () => {
    const store = createSizingStore(createMemoryStorage())
    store.record('nav', 200, 1000)
    store.record('detail', 100, 1000)
    store.clear('nav')
    expect(store.state.$()).toEqual({ detail: store.state.$().detail })
    store.clear()
    expect(store.state.$()).toEqual({})
  })

  it('is deterministic for the same inputs', () => {
    const store = createSizingStore(createMemoryStorage())
    store.record('nav', 220, 1000, true)
    store.record('detail', 300, 1000, false)
    const first = store.restore(['nav', 'detail', 'extra'], 800, { nav: 60, detail: 60, extra: 20 }, ['detail'])
    const second = store.restore(['nav', 'detail', 'extra'], 800, { nav: 60, detail: 60, extra: 20 }, ['detail'])
    expect(second).toEqual(first)
  })

  it('round-trips a record through a fake Storage<string> in memory', () => {
    const backend = createMemoryStorage()
    const first = createSizingStore(backend)
    first.record('nav', 240, 1200, true)

    const second = createSizingStore(backend)
    expect(second.state.$().nav).toMatchObject({ id: 'nav', px: 240, viewportPx: 1200, manual: true })
    expect(second.isManual('nav')).toBe(true)
  })
})
