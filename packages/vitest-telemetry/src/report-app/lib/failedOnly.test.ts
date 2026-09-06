import { describe, expect, it } from 'vitest'
import type { NavNode } from '../adapter/navTree'
import { filterFailedOnly } from './failedOnly'

const tree: NavNode[] = [
  {
    id: 'process:1', kind: 'process', label: 'p1', status: 'none', durationMs: 0, events: 0,
    children: [
      {
        id: 'file:a', kind: 'file', label: 'a.test.ts', status: 'pass', durationMs: 0, events: 0, file: 'a.test.ts',
        children: [
          { id: 'test:a::ok', kind: 'test', label: 'ok', status: 'pass', durationMs: 1, events: 0, file: 'a.test.ts', test: 'ok' },
        ],
      },
      {
        id: 'file:b', kind: 'file', label: 'b.test.ts', status: 'fail', durationMs: 0, events: 0, file: 'b.test.ts',
        children: [
          { id: 'test:b::ok', kind: 'test', label: 'ok', status: 'pass', durationMs: 1, events: 0, file: 'b.test.ts', test: 'ok' },
          { id: 'test:b::broken', kind: 'test', label: 'broken', status: 'fail', durationMs: 1, events: 0, file: 'b.test.ts', test: 'broken' },
        ],
      },
    ],
  },
  {
    id: 'process:2', kind: 'process', label: 'p2 (all pass)', status: 'none', durationMs: 0, events: 0,
    children: [
      {
        id: 'file:c', kind: 'file', label: 'c.test.ts', status: 'pass', durationMs: 0, events: 0, file: 'c.test.ts',
        children: [
          { id: 'test:c::ok', kind: 'test', label: 'ok', status: 'pass', durationMs: 1, events: 0, file: 'c.test.ts', test: 'ok' },
        ],
      },
    ],
  },
]

describe('filterFailedOnly', () => {
  it('keeps only the failing test and its ancestor chain', () => {
    const filtered = filterFailedOnly(tree)
    expect(filtered.map((n) => n.id)).toEqual(['process:1'])
    expect(filtered[0]!.children!.map((n) => n.id)).toEqual(['file:b'])
    expect(filtered[0]!.children![0]!.children!.map((n) => n.id)).toEqual(['test:b::broken'])
  })

  it('drops a root with no failing descendants entirely', () => {
    const filtered = filterFailedOnly(tree)
    expect(filtered.some((n) => n.id === 'process:2')).toBe(false)
  })

  it('returns an empty tree when nothing failed', () => {
    const allPass = [tree[1]!]
    expect(filterFailedOnly(allPass)).toEqual([])
  })
})
