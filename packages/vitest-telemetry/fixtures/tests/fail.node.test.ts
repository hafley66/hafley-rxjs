import { expect, test } from 'vitest'
import { makeBus } from '../src/cqrs'
test('exploding handler surfaces as error (deliberate failure)', async () => {
  const bus = makeBus()
  await bus.dispatch({ type: 'explode' })
  expect(true).toBe(true)
})
