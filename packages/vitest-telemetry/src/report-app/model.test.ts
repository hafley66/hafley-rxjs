// The nav tree must not depend on `selected`: rebuilding it on every click is what made selecting
// a row cost ~250 ms on a 280k-event report. This counts buildProcessNav calls across a selection
// change. No jsdom in this package, so the browser globals the url/history adapters touch are
// stubbed by hand.
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { Event } from '../report/timeline.js'

const calls = vi.hoisted(() => ({ nav: 0 }))

vi.mock('./adapter/navTree.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./adapter/navTree.js')>()
  return {
    ...actual,
    buildProcessNav: (...args: Parameters<typeof actual.buildProcessNav>) => {
      calls.nav++
      return actual.buildProcessNav(...args)
    },
  }
})

function event(overrides: Partial<Event> = {}): Event {
  return {
    t: 0, tRel: 0, iso: '', kind: 'span', realm: 'node', service: null, shard: null, project: null,
    suitePath: [], file: 'a.test.ts', test: null, testId: null, traceId: null, spanId: null, parentSpanId: null,
    pid: 100, id: 'e', parentId: null, detachedAt: null, depth: 0, attrs: {},
    ...overrides,
  }
}

const rows: Event[] = [
  event({ kind: 'process', id: 'p100', pid: 100, ppid: null, command: 'node vitest.mjs', file: '' }),
  event({ id: 's1', file: 'a.test.ts', test: 'one', t: 10, durationMs: 5 }),
  event({ id: 's2', file: 'a.test.ts', test: 'two', t: 20, durationMs: 5 }),
]

beforeAll(() => {
  const noop = () => {}
  vi.stubGlobal('window', { addEventListener: noop, removeEventListener: noop })
  vi.stubGlobal('location', { search: '', pathname: '/', hash: '' })
  vi.stubGlobal('history', { pushState: noop, replaceState: noop })
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: noop })
})

describe('model.nav', () => {
  it('does not rebuild when the selection changes, and does rebuild when the rows change', async () => {
    const { createModel } = await import('./model.js')
    const model = createModel(rows)
    expect(model.nav.$().length).toBe(1)
    const afterFirstBuild = calls.nav

    model.selected.$({ file: 'a.test.ts', test: 'one' })
    expect(model.nav.$()[0]!.children![0]!.children!.length).toBe(2)
    model.selected.$({ file: 'a.test.ts', test: 'two' })
    expect(model.nav.$().length).toBe(1)
    expect(calls.nav).toBe(afterFirstBuild)

    // the selection is still live: the event scope tracks it even though the tree does not
    expect(model.eventsForSelected.$().map((e) => e.id)).toEqual(['s2'])

    model.rows.$([...rows, event({ id: 's3', file: 'b.test.ts', test: 'three', t: 30 })])
    expect(model.nav.$()[0]!.children!.length).toBe(2)
    expect(calls.nav).toBeGreaterThan(afterFirstBuild)
    model.unsubscribe()
  })
})
