import { expect, test, vi } from 'vitest'
import { trace } from '@opentelemetry/api'
import { Logger } from '../../src/index'
import { makeBus } from '../src/cqrs'
const log = Logger(import.meta.url)

// browser-mode module mock: partial, keeps the real Bus, wraps the query handler in a span + spy
vi.mock('../src/cqrs', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../src/cqrs')>()
  const tracer = trace.getTracer('lab.mock')
  return {
    ...mod,
    makeBus: vi.fn(() => {
      const bus = mod.makeBus()
      bus.query('count', (_q, s) => tracer.startActiveSpan('mock.query count', (span) => {
        log.info('mocked query, real count={count}', { count: s.count })
        span.setAttribute('mock.count', s.count); span.end()
        return s.count * 100
      }))
      return bus
    }),
  }
})

test('vi.mock in browser: mocked query is traced', async () => {
  const bus = makeBus()
  await bus.dispatch({ type: 'increment', payload: 2 })
  expect(await bus.ask<number>({ type: 'count' })).toBe(200)
  expect(vi.mocked(makeBus)).toHaveBeenCalledTimes(1)
  log.info('mock calls={n}', { n: vi.mocked(makeBus).mock.calls.length })
})
