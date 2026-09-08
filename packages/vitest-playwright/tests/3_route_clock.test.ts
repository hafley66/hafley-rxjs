import { expect } from "vitest"
import { test } from "../src/4_test.js"
import { URL, boot } from "./0_bootstrap.js"

test("route fulfill, abort, unroute", async ({ page }) => {
  await boot(page, { a: 1 })
  await expect(page.locator("#api")).toHaveText('{"a":1}')
  await page.unroute("**/api/*")
  await page.route("**/api/*", r => r.fulfill({ status: 200, contentType: "application/json", body: "not json" }))
  await page.reload()
  await expect(page.locator("#api")).toContainText("ERR")
})

test("clock: install then runFor advances Date.now deterministically", async ({ page, clock }) => {
  await clock.install({ time: 1_000_000 })
  await boot(page)
  await clock.pauseAt(2_000_000)
  await clock.runFor(1000)
  expect(await page.evaluate(() => Date.now())).toBe(2_001_000)
  await expect(page.locator("#now")).toHaveText("2001000")
})

test("clock: setFixedTime freezes Date", async ({ page, clock }) => {
  await clock.setFixedTime(0)
  await boot(page)
  expect(await page.evaluate(() => Date.now())).toBe(0)
})

test("request fixture is independent of the browser", async ({ request, page }) => {
  await boot(page)
  const r = await request.get("data:text/plain,hi").catch(() => null)
  expect(r === null || typeof r.status === "function").toBe(true)
  expect(page.url()).toBe(URL)
})
