// Shape of the process > file > test tree, and the guarantee that building it stays linear in the
// event count (the per-process rows.filter it replaced cost processes x events).
import { describe, expect, it } from 'vitest'
import type { Event } from '../../report/timeline.js'
import { buildVerdicts } from '../lib/verdicts.js'
import { buildProcessNav, flattenLeaves } from './navTree'

function event(overrides: Partial<Event> = {}): Event {
  return {
    t: 0, tRel: 0, iso: '', kind: 'span', realm: 'node', service: null, shard: null, project: null,
    suitePath: [], file: 'a.test.ts', test: null, testId: null, traceId: null, spanId: null, parentSpanId: null,
    pid: 100, id: 'e', parentId: null, detachedAt: null, depth: 0, attrs: {},
    ...overrides,
  }
}

const rows: Event[] = [
  event({ kind: 'process', id: 'p100', pid: 100, ppid: null, command: '/usr/bin/node vitest.mjs run', file: '', spanCount: 4, durationMs: 90 }),
  event({ id: 's1', pid: 100, file: 'a.test.ts', test: 'passes', t: 10, durationMs: 5, project: 'node' }),
  event({ id: 's2', pid: 100, file: 'a.test.ts', test: 'passes', t: 20, durationMs: 5, project: 'node' }),
  event({ id: 's3', pid: 100, file: 'b.test.ts', test: 'breaks', t: 30, durationMs: 5, project: 'node' }),
  event({ kind: 'verdict', realm: 'junit', id: 'v1', pid: null, file: 'a.test.ts', test: 'passes', status: 'pass', durationMs: 12 }),
  event({ kind: 'verdict', realm: 'junit', id: 'v2', pid: null, file: 'b.test.ts', test: 'breaks', status: 'fail', durationMs: 7 }),
]

describe('buildProcessNav', () => {
  const tree = buildProcessNav(rows, buildVerdicts(rows))

  it('nests file and test rows under the process that ran them', () => {
    expect(tree.map((n) => n.id)).toEqual(['process:100'])
    expect(tree[0]!.children!.map((n) => n.id)).toEqual(['file:100/a.test.ts', 'file:100/b.test.ts'])
    expect(tree[0]!.children![0]!.children!.map((n) => n.label)).toEqual(['passes'])
    expect(tree[0]!.children![0]!.project).toBe('node')
  })

  it('takes each test row status and duration from its verdict', () => {
    const leaves = flattenLeaves(tree)
    expect(leaves.map((n) => [n.test, n.status, n.durationMs])).toEqual([
      ['passes', 'pass', 12],
      ['breaks', 'fail', 7],
    ])
  })

  it('carries no selection flag on any node', () => {
    expect(flattenLeaves(tree).every((n) => n.selected === undefined)).toBe(true)
    expect(tree[0]!.children!.every((n) => n.selected === undefined)).toBe(true)
  })

  it('scales linearly: 20x the events costs well under 20x per event', () => {
    const bulk = (count: number): Event[] => [
      ...rows,
      ...Array.from({ length: count }, (_, i) =>
        event({ id: `bulk${i}`, pid: 100, file: `f${i % 40}.test.ts`, test: `t${i % 200}`, t: i, durationMs: 1 }),
      ),
    ]
    const cost = (events: Event[]): number => {
      const verdicts = buildVerdicts(events)
      const t0 = performance.now()
      buildProcessNav(events, verdicts)
      return (performance.now() - t0) / events.length
    }
    const small = cost(bulk(2_000))
    const large = cost(bulk(40_000))
    expect(large).toBeLessThan(small * 8 + 0.01)
  })
})
