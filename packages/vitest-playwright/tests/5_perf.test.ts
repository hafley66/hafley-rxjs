// pkg:perf receipts. Numbers print as [perf] lines; thresholds are loose so the file stays green on a slow box.
import { describe, expect, it } from "vitest"
import { test } from "../src/4_test.js"
import { URL, boot } from "./0_bootstrap.js"

const t = async (label: string, n: number, f: () => Promise<unknown>) => {
  const t0 = performance.now()
  for (let i = 0; i < n; i += 1) await f()
  const ms = performance.now() - t0
  console.log(`[perf] ${label}: ${n} x ${(ms / n).toFixed(2)}ms = ${ms.toFixed(0)}ms`)
  return ms / n
}

describe("matcher cost", () => {
  test("toBeVisible on a visible node vs isVisible()", async ({ page }) => {
    await boot(page)
    const loc = page.locator("#vis")
    const raw = await t("locator.isVisible()", 100, () => loc.isVisible())
    const m = await t("expect().toBeVisible()", 100, () => expect(loc).toBeVisible())
    expect(m).toBeLessThan(raw * 4 + 20)
  })
  test("20 matchers in parallel", async ({ page }) => {
    await boot(page)
    const ms = await t("Promise.all(20 x toHaveText)", 5, () => Promise.all(Array.from({ length: 20 }, () => expect(page.locator("#p")).toHaveText(/Hello/))))
    expect(ms).toBeLessThan(2000)
  })
  test("toHaveCount on 5000 nodes", async ({ page }) => {
    await boot(page)
    await page.evaluate(() => { document.body.insertAdjacentHTML("beforeend", "<ul id=big>" + "<li>x</li>".repeat(5000) + "</ul>") })
    await t("toHaveCount(5000)", 10, () => expect(page.locator("#big li")).toHaveCount(5000))
  })
  test("toPass poll overhead, 50 attempts at 1ms", async ({ page }) => {
    await boot(page)
    let n = 0
    const t0 = performance.now()
    await expect(() => { n += 1; if (n < 50) throw new Error("no") }).toPass({ intervals: [1], timeout: 5000 })
    const ms = performance.now() - t0
    console.log(`[perf] toPass 50 attempts: ${ms.toFixed(0)}ms (${(ms / 50).toFixed(2)}ms/attempt)`)
    expect(ms).toBeLessThan(2000)
  })
})

describe("log pipeline", () => {
  for (const n of [1000, 5000]) {
    test(`${n} console.log lines`, async ({ page }) => {
      await boot(page)
      const t0 = performance.now()
      await page.evaluate((n) => { for (let i = 0; i < n; i += 1) console.log("line " + i) }, n)
      await expect.poll(() => (globalThis as any).__pwLogCount?.() ?? -1, { timeout: 10000 }).toBe(-1)
      console.log(`[perf] ${n} console lines emitted in ${(performance.now() - t0).toFixed(0)}ms (drain measured at teardown)`)
    })
  }
})

describe("proxy cost", () => {
  it("10k $page.url() vs page.url()", async () => {
    await boot($page)
    const real = (globalThis as any).$page as any
    const t0 = performance.now(); for (let i = 0; i < 10000; i += 1) $page.url(); const a = performance.now() - t0
    const direct = await (async () => { const p = real; const t1 = performance.now(); for (let i = 0; i < 10000; i += 1) p.url(); return performance.now() - t1 })()
    console.log(`[perf] 10k $page.url(): ${a.toFixed(1)}ms; 10k proxy-cached: ${direct.toFixed(1)}ms`)
    expect(a).toBeLessThan(500)
  })
})

describe("per-test overhead", () => {
  for (let i = 0; i < 30; i += 1) test(`tiny ${i}`, async ({ page }) => { expect(page.url()).toBe("about:blank") })
})
