// pkg:anti receipts: attempts to break the ALS / resource bridge. Each case names the seam it attacks.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"
import { timer } from "rxjs"
import { map, firstValueFrom } from "rxjs"
import { test } from "../src/4_test.js"
import { URL, boot } from "./0_bootstrap.js"

const msg = (p: Promise<unknown>) => p.then(() => "resolved", (e: Error) => e.message)

describe("als: leaked callbacks", () => {
  const leak: { from: string; url?: string; err?: string }[] = []
  test("A leaks a timer that reads $page during B", async ({ page }) => {
    await boot(page)
    await page.goto(URL + "#A")
    setTimeout(() => { try { leak.push({ from: "A", url: $page.url() }) } catch (e) { leak.push({ from: "A", err: (e as Error).message }) } }, 150)
  })
  test("B runs while A's timer fires", async ({ page }) => {
    await boot(page)
    await page.goto(URL + "#B")
    await new Promise(r => setTimeout(r, 300))
    expect(leak.length).toBe(1)
    // seam: the leaked callback carries A's store; the bridge refuses it by phase instead of handing back A's closed page
    expect(leak[0]).toEqual({ from: "A", err: expect.stringMatching(/finished test/) })
  })
})

describe("als: playwright event dispatch", () => {
  test("$page inside page.on('console')", async ({ page }) => {
    await boot(page)
    let out = ""
    page.on("console", () => { try { out = $page.url() } catch (e) { out = "ERR " + (e as Error).message } })
    await page.evaluate(() => console.log("hi"))
    await expect.poll(() => out).not.toBe("")
    expect(out).toBe(URL)
  })
  test("$page inside page.route handler", async ({ page }) => {
    let out = ""
    await page.route("**/api/*", r => { try { out = $page.url() } catch (e) { out = "ERR " + (e as Error).message } return r.fulfill({ json: {} }) })
    await page.route(URL, r => r.fulfill({ contentType: "text/html", body: "<script>fetch('/api/x')</script>" }))
    await page.goto(URL)
    await expect.poll(() => out).not.toBe("")
    expect(out).toBe(URL)
  })
  test("$page inside body-owned async (timeout, microtask, rx timer)", async ({ page }) => {
    await boot(page)
    const a = await new Promise<string>(r => setTimeout(() => r($page.url()), 5))
    const b = await new Promise<string>(r => queueMicrotask(() => r($page.url())))
    const c = await firstValueFrom(timer(5).pipe(map(() => $page.url())))
    expect([a, b, c]).toEqual([URL, URL, URL])
  })
})

describe("timers", () => {
  test("vi.useFakeTimers freezes toPass", { timeout: 3000 }, async ({ page, signal }) => {
    await boot(page)
    signal.addEventListener("abort", () => vi.useRealTimers())
    vi.useFakeTimers()
    try {
      let n = 0
      const t0 = performance.now()
      const m = await msg(expect(() => { n += 1; if (n < 3) throw new Error("no") }).toPass({ timeout: 300, intervals: [10] }))
      const ms = performance.now() - t0
      // seam: poll$ runs on timers captured at import, so the fake clock cannot freeze toPass
      expect({ m, n, fastEnough: ms < 2000 }).toEqual({ m: "resolved", n: 3, fastEnough: true })
    } finally { vi.useRealTimers() }
  })
  // pw: client dispatch needs real timers; the body hangs until the test timeout. The bridge restores real timers
  // at capture (logged under ["vitest-playwright","bridge"]) so capture, release and the next test proceed.
  test.fails("vi.useFakeTimers hangs the pw client until the test timeout; teardown still runs", { timeout: 1500 }, async ({ page }) => {
    await boot(page)
    vi.useFakeTimers()
    await expect(page.locator("#hidden")).toBeVisible({ timeout: 100 })
  })
  test("real timers are back for the next test", async ({ page }) => {
    expect(vi.isFakeTimers()).toBe(false)
    await boot(page)
    await expect(page.locator("#vis")).toBeVisible()
  })
  test.fails("timeout: 0 on a matcher is bounded by the test timeout via ctx.signal", { timeout: 400 }, async ({ page }) => {
    await boot(page)
    await expect(page.locator("#hidden")).toBeVisible({ timeout: 0 })
  })
  test("previous test's matcher did not outlive its test", async ({ page }) => {
    await boot(page)
    await expect(page.locator("#vis")).toBeVisible()
  })
})

describe("fixtures", () => {
  beforeEach(async ({ page }: any) => { await boot(page) })
  test("beforeEach can destructure page", async ({ page }) => { expect(page.url()).toBe(URL) })
  const ext = test.extend<{ tag: string }>({ tag: async ({ page }, use) => { await use("tag:" + page.url()) } })
  ext("test.extend chains through the bridge", async ({ tag, page }) => { expect(tag).toBe("tag:" + page.url()) })
})

describe("self-destruction inside the body", () => {
  test("page.close() in the body; capture and release survive", async ({ page }) => { await boot(page); await page.close() })
  test("context.close() in the body; release survives", async ({ page, context }) => { await boot(page); await context.close() })
  test("next test still gets a fresh page", async ({ page, browser }) => { await boot(page); expect(browser.contexts().length).toBe(1) })
})

describe("expect surfaces", () => {
  test.fails("expect.soft with a pw matcher fails the test at the end", async ({ page }) => {
    await boot(page)
    await expect.soft(page.locator("#hidden")).toBeVisible({ timeout: 100 })
    await expect(page.locator("#vis")).toBeVisible()
  })
  test("unawaited pw matcher is reported", async ({ page, expect }) => {
    await boot(page)
    // vitest flags unawaited async assertions at test end; the bridge returns a bare thenable
    const p = expect(page.locator("#vis")).toBeVisible()
    expect(typeof (p as any).then).toBe("function")
    await p
  })
  it("proxy identity: $page.on is a fresh bind per get", () => {
    expect($page.on === $page.on).toBe(false)
  })
})

describe("retry", () => {
  const dirs: string[] = []
  let attempt = 0
  test("fresh page per retry", { retry: 1 }, async ({ page, task }) => {
    await boot(page)
    dirs.push(`${task.result?.retryCount ?? 0}`)
    const x = await page.evaluate(() => (window as any).x)
    await page.evaluate(() => { (window as any).x = 1 })
    attempt += 1
    expect(x).toBeUndefined()
    if (attempt === 1) throw new Error("first attempt fails on purpose")
  })
  test("retry counters were distinct", () => { expect(dirs).toEqual(["0", "1"]) })
  let tries = 0
  test("a retry after a timeout still polls on a live signal", { retry: 1, timeout: 400 }, async ({ page }) => {
    await boot(page)
    tries += 1
    if (tries === 1) await new Promise(r => setTimeout(r, 1000))
    const t0 = performance.now()
    const m = await msg(expect(page.locator("#hidden")).toBeVisible({ timeout: 150 }))
    // seam: vitest keeps one AbortController per test across retries; the bridge derives a fresh signal per attempt
    expect(m).toContain("Timeout:  150ms")
    expect(performance.now() - t0).toBeGreaterThan(100)
  })
})

describe.concurrent("8-way concurrent ownership", () => {
  for (const i of [1, 2, 3, 4, 5, 6, 7, 8]) {
    test(`slot ${i}`, async ({ page }) => {
      await boot(page)
      await page.goto(URL + "#" + i)
      await new Promise(r => setTimeout(r, 50))
      expect($page.url()).toBe(URL + "#" + i)
      await expect($page).toHaveURL(new RegExp("#" + i + "$"))
    })
  }
})

describe("net log, both realms", () => {
  test("browser fetch and navigation land in log.net with status and ms", async ({ page, log }) => {
    await boot(page, { ok: 1 })
    await expect(page.locator("#api")).toHaveText('{"ok":1}')
    const api = log.$().net.filter(n => n.url.endsWith("/api/thing"))
    expect(api.map(n => [n.realm, n.phase, n.status])).toEqual([["browser", "request", undefined], ["browser", "response", 200]])
    expect(log.$().net.find(n => n.url === URL && n.phase === "response")?.resourceType).toBe("document")
  })
  test("node fetch lands in log.net tagged with this test", async ({ page, log, task }) => {
    const { createServer } = await import("node:http")
    const server = createServer((_q, res) => { res.statusCode = 201; res.end("x") })
    await new Promise<void>(r => server.listen(0, "127.0.0.1", r))
    const port = (server.address() as any).port
    try {
      await fetch(`http://127.0.0.1:${port}/node-side`)
      await boot(page)
    } finally { server.close() }
    await expect.poll(() => log.$().net.filter(n => n.realm === "node" && n.phase === "response")).toEqual([expect.objectContaining({ url: `http://127.0.0.1:${port}/node-side`, status: 201, owner: task.id })])
  })
})

afterAll(async () => {
  const { readdirSync, statSync } = await import("node:fs")
  const { join } = await import("node:path")
  const root = "out/pw/tests-4-anti-test"
  let empty = 0, total = 0
  try { for (const d of readdirSync(root)) { total += 1; if (statSync(join(root, d)).isDirectory() && readdirSync(join(root, d)).length === 0) empty += 1 } } catch {}
  console.log(`[anti] attempt dirs total=${total} empty=${empty}`)
  expect(empty).toBe(0)
})

describe("logtape sees every fart", () => {
  test("page, net (both realms), api and bridge records arrive under ['vitest-playwright', *]", async ({ page }) => {
    const lt = await import("@logtape/logtape")
    const records: { category: readonly string[]; message: readonly unknown[]; properties: Record<string, unknown> }[] = []
    await lt.configure({ reset: true, sinks: { mem: r => { records.push(r as any) } }, loggers: [{ category: ["vitest-playwright"], lowestLevel: "debug", sinks: ["mem"] }, { category: ["logtape", "meta"], sinks: [] }] })
    try {
      const { createServer } = await import("node:http")
      const server = createServer((_q, res) => { res.statusCode = 200; res.end("x") })
      await new Promise<void>(r => server.listen(0, "127.0.0.1", r))
      const port = (server.address() as any).port
      await fetch(`http://127.0.0.1:${port}/n`).finally(() => server.close())
      await boot(page)
      await page.evaluate(() => console.log("hello"))
      await expect(page.locator("#api")).toHaveText(/ok/)
      vi.useFakeTimers(); vi.useRealTimers()
      const by = (c: string) => records.filter(r => r.category[1] === c)
      await expect.poll(() => by("page").length).toBeGreaterThan(0)
      expect(by("net").map(r => [r.properties.realm, r.properties.phase])).toEqual(expect.arrayContaining([["node", "request"], ["node", "response"], ["browser", "request"], ["browser", "response"]]))
      expect(by("api").some(r => String(r.properties.title).startsWith("Frame.") || String(r.properties.title).startsWith("Page."))).toBe(true)
    } finally { await lt.reset() }
  })
})
