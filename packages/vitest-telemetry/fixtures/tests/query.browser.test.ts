import { expect, test } from 'vitest'
import debug from 'debug'
import { makeBus } from '../src/cqrs'
import { captured } from '../../src/index'
const dbg = debug('lab:browser')

test('query on browser realm', async () => {
  const bus = makeBus()
  await bus.dispatch({ type: 'increment', payload: 5 })
  expect(await bus.ask<number>({ type: 'count' })).toBe(5)
})
test('debug.js bridged in browser', () => {
  dbg('from browser')
  expect(captured.some(r => r.category[0] === 'debug' && r.message.join('').includes('from browser'))).toBe(true)
})
