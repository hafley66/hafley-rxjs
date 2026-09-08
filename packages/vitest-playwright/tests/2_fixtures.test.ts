import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { test } from "../src/4_test.js"
import { URL, boot } from "./0_bootstrap.js"

describe("page per test", () => {
  test("first test writes window.x", async ({ page }) => {
    await boot(page)
    await page.evaluate(() => { (window as any).x = 1 })
    expect(await page.evaluate(() => (window as any).x)).toBe(1)
  })
  test("second test does not see it", async ({ page }) => {
    await boot(page)
    expect(await page.evaluate(() => (window as any).x)).toBeUndefined()
  })
})

describe("$page in hooks", () => {
  let seen: string[] = []
  beforeEach(async () => { await boot($page); seen.push("beforeEach:" + $page.url()) })
  afterEach(() => { seen.push("afterEach:" + $page.url()) })
  test("body sees the same page the hooks saw", async ({ page }) => {
    expect($page.url()).toBe(URL)
    expect(page.url()).toBe(URL)
    expect(seen.at(-1)).toBe("beforeEach:" + URL)
  })
})

describe("$page outside a test", () => {
  let err: string | undefined
  beforeAll(() => { try { void $page.url() } catch (e) { err = (e as Error).message } })
  it("throws in beforeAll", () => { expect(err).toMatch(/no running test/) })
})

describe.concurrent("concurrent ownership", () => {
  const gate = { a: false, b: false }
  test("A", async ({ page, expect }) => {
    await boot(page)
    await page.goto(URL + "#a")
    gate.a = true
    await expect.poll(() => gate.b, { timeout: 5000 }).toBe(true)
    expect($page.url()).toBe(URL + "#a")
    await expect($page).toHaveURL(/#a$/)
  })
  test("B", async ({ page, expect }) => {
    await boot(page)
    await page.goto(URL + "#b")
    gate.b = true
    await expect.poll(() => gate.a, { timeout: 5000 }).toBe(true)
    expect($page.url()).toBe(URL + "#b")
    await expect($page).toHaveURL(/#b$/)
  })
})

describe("teardown and logs", () => {
  test("browser has no leftover contexts from earlier tests", async ({ browser, page }) => {
    await boot(page)
    expect(browser.contexts().length).toBe(1)
  })
  test("contextOptions override per file", async ({ page }) => {
    await boot(page)
    expect(await page.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches)).toBe(false)
  })
})

const dark = test.extend<{ $test: { contextOptions: import("playwright").BrowserContextOptions } }>({ contextOptions: async ({}, use) => { await use({ colorScheme: "dark" }) } })
dark("dark contextOptions via test.extend", async ({ page }) => {
  await boot(page)
  expect(await page.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches)).toBe(true)
})

describe("failOnPageError", () => {
  test.fails("a page error fails the test at teardown", async ({ page }) => {
    await boot(page)
    await page.evaluate(() => setTimeout(() => { throw new Error("boom") }, 0))
    await page.waitForTimeout(50)
  })
})
