// pwp:pw-ctx: one context per test, closed when the test ends (PW/index.js:384,413). The first test
// records its context and a close listener; the second test, which already owns a fresh context of its
// own, asserts the first one closed and left browser.contexts().
import { expect, test } from "../../../../src/4_test.js"
import type { BrowserContext } from "playwright"

let first: BrowserContext | undefined
let firstClosed = false

test("a test owns exactly one context", async ({ browser, context, page }) => {
  first = context
  context.on("close", () => {
    firstClosed = true
  })
  await page.goto("about:blank")
  expect(browser.contexts()).toContain(context)
  expect(browser.contexts().length).toBe(1)
})

test("that context is closed when the test ends", ({ browser, context }) => {
  expect(first, "pw-ctx: the first test must have run").toBeDefined()
  expect(firstClosed, "pw-ctx: the per-test context must emit close at the end of its test").toBe(true)
  expect(browser.contexts(), "pw-ctx: the closed context must be gone from browser.contexts()").not.toContain(first)
  expect(context, "pw-ctx: the second test must get its own context").not.toBe(first)
})
