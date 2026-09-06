import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { trace } from '@opentelemetry/api'
import { makeBus } from '../src/cqrs'
import { mountCounter } from '../src/counter'
import { Logger } from '../../src/index'
const log = Logger(import.meta.url)

test('click increments through the bus', async () => {
  const root = document.createElement('div'); document.body.append(root)
  mountCounter(root, makeBus())
  await trace.getTracer('lab.test').startActiveSpan('user.clicks', async (span) => {
    await page.getByRole('button', { name: 'inc' }).click()
    await page.getByRole('button', { name: 'inc' }).click()
    span.end()
  })
  await expect.element(page.getByRole('status')).toHaveTextContent('2')
  log.info('browser url={url} category={cat}', { url: import.meta.url, cat: log.category })
})
