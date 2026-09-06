import { describe, expect, it } from 'vitest'
import type { NavNode } from '../adapter/navTree'
import { findFirstFailure, findFirstLeaf } from './navSelection'

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
          { id: 'test:b::broken', kind: 'test', label: 'broken', status: 'fail', durationMs: 1, events: 0, file: 'b.test.ts', test: 'broken' },
        ],
      },
    ],
  },
]

describe('findFirstLeaf', () => {
  it('returns the first test node depth-first', () => {
    expect(findFirstLeaf(tree)).toEqual({ file: 'a.test.ts', test: 'ok' })
  })
  it('returns null for an empty tree', () => {
    expect(findFirstLeaf([])).toBeNull()
  })
})

describe('findFirstFailure', () => {
  it('returns the first failing test, skipping passing ones', () => {
    expect(findFirstFailure(tree)).toEqual({ file: 'b.test.ts', test: 'broken' })
  })
  it('returns null when nothing failed', () => {
    const passingOnly = [tree[0]!.children![0]!]
    expect(findFirstFailure(passingOnly)).toBeNull()
  })
})
