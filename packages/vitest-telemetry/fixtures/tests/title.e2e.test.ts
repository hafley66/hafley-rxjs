import { expect, test } from 'vitest'
import { liveApp } from './e2e.harness'
const app = liveApp('title')

test('live app renders heading', async () => {
  const page = app.page()
  await page.goto(app.url())
  await expect.poll(() => page.locator('h1').textContent()).toBe('lab app')
})
test('live app has one output', async () => {
  expect(await app.page().locator('output').count()).toBe(1)
})
