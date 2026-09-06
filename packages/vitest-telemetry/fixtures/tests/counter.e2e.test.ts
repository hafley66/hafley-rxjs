import { expect, test } from 'vitest'
import { liveApp } from './e2e.harness'
import { Logger } from '../../src/index'
const log = Logger(import.meta.url)
const app = liveApp('counter')

test('live app increments', async () => {
  const page = app.page()
  await page.goto(app.url())
  await page.getByRole('button', { name: 'inc' }).click()
  await page.getByRole('button', { name: 'inc' }).click()
  await expect.poll(() => page.locator('#out').textContent()).toBe('2')
  log.info('e2e done on {url}', { url: page.url() })
})
