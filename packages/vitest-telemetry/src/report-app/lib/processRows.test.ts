import { describe, expect, it } from 'vitest'
import type { Event } from '../../report/timeline.js'
import { collectProcessRows, parseAncestry, projectOfRows, shortCommand } from './processRows'

function processEvent(overrides: Partial<Event> = {}): Event {
  return {
    t: 0, tRel: 0, iso: '', kind: 'process', realm: 'node', service: null, shard: null, project: null,
    suitePath: [], file: '', test: null, testId: null, traceId: null, spanId: null, parentSpanId: null,
    pid: 100, id: 'p', parentId: null, detachedAt: null, depth: 0, attrs: {},
    ...overrides,
  }
}

describe('shortCommand', () => {
  it('keeps the binary name and strips directories off plain args', () => {
    expect(shortCommand('/usr/bin/node /repo/vitest.mjs run')).toBe('node vitest.mjs run')
  })
  it('keeps flags as-is', () => {
    expect(shortCommand('node vitest.mjs --shard=1/2')).toBe('node vitest.mjs --shard=1/2')
  })
  it('returns a placeholder for an empty command', () => {
    expect(shortCommand('   ')).toBe('(unknown)')
  })
})

describe('parseAncestry', () => {
  it('parses "pid ppid command..." lines', () => {
    expect(parseAncestry(['100 1 sh -c pnpm test', '99 0 launchd'])).toEqual([
      { pid: 100, ppid: 1, command: 'sh -c pnpm test' },
      { pid: 99, ppid: 0, command: 'launchd' },
    ])
  })
  it('returns an empty array for undefined', () => {
    expect(parseAncestry(undefined)).toEqual([])
  })
})

describe('collectProcessRows', () => {
  it('folds real process events and fills in synthetic ancestors', () => {
    const rows = collectProcessRows([
      processEvent({ pid: 100, ppid: 1, command: 'node vitest.mjs', spanCount: 5, ancestry: ['1 0 sh -c pnpm'] }),
    ])
    expect(rows.get(100)).toMatchObject({ pid: 100, ppid: 1, synthetic: false, spanCount: 5 })
    // ppid 0 folds to null: `ancestor.ppid || null` treats a literal 0 (launchd/init) as "no parent".
    expect(rows.get(1)).toMatchObject({ pid: 1, ppid: null, command: 'sh -c pnpm', synthetic: true })
  })
})

describe('projectOfRows', () => {
  it('returns the most common project', () => {
    expect(projectOfRows([processEvent({ project: 'a' }), processEvent({ project: 'a' }), processEvent({ project: 'b' })])).toBe('a')
  })
  it('returns undefined when no row has a project', () => {
    expect(projectOfRows([processEvent()])).toBeUndefined()
  })
})
