import { describe, expect, it } from 'vitest'
import type { Event } from '../../report/timeline.js'
import { buildVerdicts, verdictOf } from './verdicts'

function verdictEvent(overrides: Partial<Event> = {}): Event {
  return {
    t: 0, tRel: 0, iso: '', kind: 'verdict', realm: 'node', service: null, shard: null, project: null,
    suitePath: [], file: 'a.test.ts', test: 'works', testId: null, traceId: null, spanId: null,
    parentSpanId: null, pid: null, id: 'a', parentId: null, detachedAt: null, depth: 0, attrs: {},
    level: 'info', status: 'pass', durationMs: 12, failure: null,
    ...overrides,
  }
}

describe('buildVerdicts', () => {
  it('keys verdicts by file::test and ignores non-verdict rows', () => {
    const rows = [verdictEvent(), verdictEvent({ file: 'b.test.ts', test: 'fails', status: 'fail', failure: 'boom' }), verdictEvent({ kind: 'log' })]
    const verdicts = buildVerdicts(rows)
    expect(verdicts.size).toBe(2)
    expect(verdicts.get('a.test.ts::works')).toEqual({ status: 'pass', durationMs: 12, failure: null })
    expect(verdicts.get('b.test.ts::fails')).toEqual({ status: 'fail', durationMs: 12, failure: 'boom' })
  })
})

describe('verdictOf', () => {
  it('returns the none default when no verdict is recorded', () => {
    const verdicts = buildVerdicts([])
    expect(verdictOf(verdicts, 'x.test.ts', 'missing')).toEqual({ status: 'none', durationMs: 0, failure: null })
  })

  it('finds a recorded verdict by file and test', () => {
    const verdicts = buildVerdicts([verdictEvent({ file: 'x.test.ts', test: 'it' })])
    expect(verdictOf(verdicts, 'x.test.ts', 'it').status).toBe('pass')
  })
})
