import { describe, expect, it } from "vitest"
import { test } from "../src/4_test.js"
import { boot } from "./0_bootstrap.js"

const fail = (p: Promise<unknown>) => p.then(() => { throw new Error("expected rejection") }, (e: Error) => e.message)

describe("truthy family", () => {
  test("visible / hidden / not / option-negated", async ({ page }) => {
    await boot(page)
    await expect(page.locator("#vis")).toBeVisible()
    await expect(page.locator("#hidden")).toBeHidden()
    await expect(page.locator("#hidden")).not.toBeVisible()
    await expect(page.locator("#hidden")).toBeVisible({ visible: false })
    await expect(page.locator("#vis")).toBeAttached()
    await expect(page.locator("#nope")).toBeAttached({ attached: false })
  })
  test("failure message carries locator, expected, received, timeout", async ({ page }) => {
    await boot(page)
    const m = await fail(expect(page.locator("#hidden")).toBeVisible({ timeout: 200 }))
    expect(m).toContain("expect(locator('#hidden')).toBeVisible() failed")
    expect(m).toContain("Expected: visible")
    expect(m).toContain("Timeout:  200ms")
  })
  test("checked payloads", async ({ page }) => {
    await boot(page)
    await expect(page.locator("#cb")).toBeChecked()
    await expect(page.locator("#cb2")).toBeChecked({ checked: false })
    await expect(page.locator("#cb2")).not.toBeChecked()
    await page.locator("#cb2").evaluate((e: HTMLInputElement) => { e.indeterminate = true })
    await expect(page.locator("#cb2")).toBeChecked({ indeterminate: true })
    expect(() => (expect(page.locator("#cb2")) as any).toBeChecked({ indeterminate: true, checked: false })).toThrow(/indeterminate and checked/)
  })
  test("enabled / disabled / editable / empty / focused / viewport", async ({ page }) => {
    await boot(page)
    await expect(page.locator("#dis")).toBeDisabled()
    await expect(page.locator("#cb")).toBeEnabled()
    await expect(page.locator("#dis")).toBeEnabled({ enabled: false })
    await expect(page.locator("#ro")).toBeEditable({ editable: false })
    await expect(page.locator("#val")).toBeEditable()
    await expect(page.locator("#empty")).toBeEmpty()
    await page.locator("#focus").focus()
    await expect(page.locator("#focus")).toBeFocused()
    await expect(page.locator("#far")).not.toBeInViewport()
    await page.locator("#far").scrollIntoViewIfNeeded()
    await expect(page.locator("#far")).toBeInViewport({ ratio: 0.5 })
  })
  test("server-side retry: #late appears after 300ms", async ({ page }) => {
    await boot(page)
    await expect(page.locator("#late")).toHaveText("late")
  })
  test("wrong receiver throws synchronously", async ({ page }) => {
    await boot(page)
    expect(() => (expect("str") as any).toBeVisible()).toThrow(/expected a playwright Locator, received string/)
  })
})

describe("text and equal families", () => {
  test("text scalar, array, substring, ignoreCase, useInnerText", async ({ page }) => {
    await boot(page)
    const p = page.locator("#p")
    await expect(p).toHaveText("Hello World")
    await expect(p).toHaveText(/hello/i)
    await expect(p).toContainText("HELLO", { ignoreCase: true })
    await expect(p).not.toContainText("bye")
    await expect(page.locator("li")).toHaveText(["a", "b", "c"])
    await expect(page.locator("li")).toContainText(["a", /c/])
    await expect(p).toHaveText("Hello World", { useInnerText: true })
  })
  test("attribute presence, value, options-only, RegExp", async ({ page }) => {
    await boot(page)
    const p = page.locator("#p")
    await expect(p).toHaveAttribute("data-k")
    await expect(p).toHaveAttribute("data-k", "v")
    await expect(p).toHaveAttribute("data-k", /V/, { ignoreCase: true })
    await expect(p).toHaveAttribute("data-k", { timeout: 500 })
    await expect(p).not.toHaveAttribute("data-x")
  })
  test("class, containClass, id, role, css with pseudo, js property", async ({ page }) => {
    await boot(page)
    const p = page.locator("#p")
    await expect(p).toHaveClass("a b")
    await expect(p).toHaveClass(/\ba\b/)
    await expect(p).toContainClass("b")
    await expect(page.locator("li")).toHaveClass(["", "", ""])
    expect(() => (expect(p) as any).toContainClass(/a/)).toThrow(/cannot be a RegExp/)
    await expect(p).toHaveId("p")
    await expect(page.locator("#acc")).toHaveRole("button")
    expect(() => (expect(p) as any).toHaveRole(/x/)).toThrow(/must be a string/)
    await expect(p).toHaveCSS("content", '"pre"', { pseudo: "before" })
    await expect(p).toHaveJSProperty("title", "t")
    await page.evaluate(() => (window as any).setState("p", "changed"))
    await expect(p).toHaveJSProperty("textContent", "changed")
  })
  test("count, value, values, accessible name/description", async ({ page }) => {
    await boot(page)
    await expect(page.locator("li")).toHaveCount(3)
    const m = await fail(expect(page.locator("li")).toHaveCount(4, { timeout: 200 }))
    expect(m).toContain("Expected: 4")
    expect(m).toContain("Received: 3")
    await expect(page.locator("#val")).toHaveValue("v1")
    await expect(page.locator("#multi")).toHaveValues(["x", "y"])
    await expect(page.locator("#multi")).toHaveValues([/x/, "y"])
    await expect(page.locator("#multi")).not.toHaveValues(["y", "x"])
    await expect(page.locator("#acc")).toHaveAccessibleName("acc name")
    await expect(page.locator("#acc")).toHaveAccessibleName("ACC NAME", { ignoreCase: true })
    await expect(page.locator("#acc")).toHaveAccessibleDescription(/desc/)
  })
})

describe("page-level, toBeOK, toPass", () => {
  test("title, url string / RegExp / predicate / URLPattern / not", async ({ page }) => {
    await boot(page)
    await expect(page).toHaveTitle("bootstrap page")
    await expect(page).toHaveTitle(/boot/)
    await expect(page).toHaveURL("http://bootstrap.test/")
    await expect(page).toHaveURL(/bootstrap\.test/)
    await expect(page).toHaveURL(u => u.hostname === "bootstrap.test")
    await expect(page).toHaveURL(new URLPattern({ hostname: "bootstrap.test" }))
    await expect(page).not.toHaveURL(/other/)
    await expect(page).not.toHaveURL(u => u.hostname === "other", { timeout: 300 })
  })
  test("url resolves relative strings against baseURL", async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: "http://bootstrap.test" })
    const p = await ctx.newPage()
    try { await boot(p); await expect(p).toHaveURL("/") } finally { await ctx.close() }
  })
  test("toBeOK", async ({ request }) => {
    const { createServer } = await import("node:http")
    const server = createServer((req, res) => { res.statusCode = req.url === "/ok" ? 200 : 404; res.end("x") })
    await new Promise<void>(r => server.listen(0, "127.0.0.1", r))
    const port = (server.address() as any).port
    try {
      const ok = await request.get(`http://127.0.0.1:${port}/ok`)
      const bad = await request.get(`http://127.0.0.1:${port}/bad`)
      await expect(ok).toBeOK()
      await expect(bad).not.toBeOK()
      expect(await fail(expect(bad).toBeOK())).toContain("Received: 404")
    } finally { server.close() }
  })
  test("toPass matrix", async () => {
    let n = 0
    await expect(() => { if (++n < 3) throw new Error("not yet") }).toPass({ intervals: [10, 10] })
    expect(n).toBe(3)
    let m = 0
    await expect(async () => { if (++m < 3) throw new Error("not yet") }).toPass({ intervals: [10] })
    const msg = await fail(expect(() => { throw new Error("never") }).toPass({ timeout: 200, intervals: [20] }))
    expect(msg).toContain("timeout 200ms")
    await expect(() => { throw new Error("always") }).not.toPass({ intervals: [10] })
    expect(await fail(expect(() => {}).not.toPass({ timeout: 150, intervals: [20] }))).toContain("toPass() failed")
  })
  test("expect.poll with a locator matcher throws the playwright message", async ({ page }) => {
    await boot(page)
    await expect(async () => { await (expect.poll(() => page.locator("#vis")) as any).toBeVisible() }).rejects.toThrow(/expect.poll\(\) does not support "toBeVisible"/)
  })
  test.fails("signal abort: a matcher longer than the test fails with the test timeout", { timeout: 800 }, async ({ page }) => {
    await boot(page)
    await expect(page.locator("#hidden")).toBeVisible({ timeout: 10_000 })
  })
  test("the aborted matcher released the page: next test starts within the budget", async ({ page }) => {
    const t0 = performance.now()
    await boot(page)
    expect(performance.now() - t0).toBeLessThan(3000)
  })
})

it("plain vitest it + $page works too (lazy browser)", async () => {
  await boot($page)
  await expect($page.locator("#vis")).toBeVisible()
})
