// pwp:pw-page: the page fixture has no teardown of its own (PW/index.js:445); the context close is
// what closes it. So a page saved in one test is closed once that test's context closes.
import { expect, test } from "../../../../src/4_test.js"
import type { Page } from "playwright"

let savedPage: Page | undefined

test("a page is open during its test", async ({ page }) => {
  savedPage = page
  await page.goto("about:blank")
  expect(page.isClosed()).toBe(false)
})

test("the page is closed by the context close", async () => {
  expect(savedPage).toBeDefined()
  expect(savedPage?.isClosed()).toBe(true)
})