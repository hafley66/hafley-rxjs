import { describe, expect, onTestFinished, test } from 'vitest'
import debug from 'debug'
import { makeBus } from '../src/cqrs'
import { Logger, captured } from '../../src/index'
const log = Logger(import.meta.url)
const dbg = debug('lab:cqrs-test')

describe('cqrs on node', () => {
  test('increment then query', async () => {
    const bus = makeBus()
    await bus.dispatch({ type: 'increment', payload: 2 })
    await bus.dispatch({ type: 'increment' })
    expect(await bus.ask<number>({ type: 'count' })).toBe(3)
    log.info('done, events={events}', { events: bus.state.events })
  })
  test('debug.js lands in logtape', () => {
    dbg('hello %s', 'world')
    onTestFinished(() => {
      const hit = captured.find(r => r.category.join(':') === 'debug:lab:cqrs-test')
      expect(Boolean(hit)).toBe(true)
    })
  })
  test('logger category is repo path', () => {
    expect(log.category).toEqual(['lab', 'fixtures', 'tests', 'cqrs.node.test.ts'])
  })
})
