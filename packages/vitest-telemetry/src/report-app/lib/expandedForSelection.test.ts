import { describe, expect, it } from 'vitest'
import type { NavNode } from '../adapter/navTree'
import { expandedPathTo } from './expandedForSelection'

const tree: NavNode[] = [
  {
    id: 'process:1', kind: 'process', label: 'p1', status: 'none', durationMs: 0, events: 0,
    children: [
      {
        id: 'file:a', kind: 'file', label: 'a.test.ts', status: 'fail', durationMs: 0, events: 0, file: 'a.test.ts',
        children: [
          { id: 'test:a::broken', kind: 'test', label: 'broken', status: 'fail', durationMs: 1, events: 0, file: 'a.test.ts', test: 'broken' },
        ],
      },
    ],
  },
  {
    id: 'process:2', kind: 'process', label: 'p2', status: 'none', durationMs: 0, events: 0,
    children: [],
  },
]

describe('expandedPathTo', () => {
  it('collects every ancestor id from immediate parent up to the root', () => {
    expect(expandedPathTo(tree, { file: 'a.test.ts', test: 'broken' })).toEqual({ 'file:a': true, 'process:1': true })
  })
  it('returns null when the selection has no file', () => {
    expect(expandedPathTo(tree, { file: null, test: null })).toBeNull()
  })
  it('returns null when nothing in the tree matches', () => {
    expect(expandedPathTo(tree, { file: 'missing.test.ts', test: 'x' })).toBeNull()
  })
})
