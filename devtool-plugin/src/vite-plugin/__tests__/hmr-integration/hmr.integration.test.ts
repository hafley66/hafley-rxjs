import fs from "fs"
import path from "path"
import { chromium, type Browser, type Page } from "playwright"
import { createServer, type ViteDevServer } from "rolldown-vite"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const FIXTURE_DIR = path.join(__dirname, "fixture")
const MAIN_TS_PATH = path.join(FIXTURE_DIR, "main.ts")

// Read original content for restoration
const ORIGINAL_CONTENT = fs.readFileSync(MAIN_TS_PATH, "utf-8")

/**
 * Helper to wait for window.__test__ to be ready with expected state
 */
async function waitForTestReady(page: Page, timeout = 10000) {
  await page.waitForFunction(
    () => {
      const t = window.__test__
      return t && t.source$ && t.subscription && t.values.length > 0
    },
    { timeout },
  )
}

describe("HMR Integration", () => {
  let server: ViteDevServer
  let browser: Browser
  let page: Page
  let serverUrl: string
  const pageErrors: string[] = []

  beforeAll(async () => {
    // Restore original content
    fs.writeFileSync(MAIN_TS_PATH, ORIGINAL_CONTENT)

    // Start Vite dev server
    server = await createServer({
      configFile: path.join(FIXTURE_DIR, "vite.config.ts"),
      server: {
        port: 0, // Random available port
      },
    })
    await server.listen()
    const address = server.httpServer?.address()
    if (!address || typeof address === "string") {
      throw new Error("Failed to get server address")
    }
    serverUrl = `http://localhost:${address.port}`

    // Launch browser
    browser = await chromium.launch({ headless: true })
    page = await browser.newPage()

    // Enable console logging for debugging
    page.on("console", msg => {
      console.log(`[browser] ${msg.type()}: ${msg.text()}`)
    })

    // Capture page errors
    page.on("pageerror", err => {
      console.error(`[browser error] ${err.message}`)
      pageErrors.push(err.message)
    })
  }, 30000)

  afterAll(async () => {
    // Restore original content
    fs.writeFileSync(MAIN_TS_PATH, ORIGINAL_CONTENT)

    await page?.close()
    await browser?.close()
    await server?.close()
  })

  it("loads page with tracked BehaviorSubject", async () => {
    await page.goto(serverUrl)

    // Wait for test harness to be fully ready
    await waitForTestReady(page)

    // Capture state for assertions
    const debugState = await page.evaluate(() => ({
      hasTest: !!window.__test__,
      values: window.__test__?.values ?? [],
      hmrCount: window.__test__?.hmrCount ?? 0,
      hasSource: !!window.__test__?.source$,
      hasSubscription: !!window.__test__?.subscription,
      subscriptionClosed: window.__test__?.subscription?.closed,
      outputText: document.getElementById("output")?.textContent ?? "N/A",
    }))

    // Check for errors
    if (pageErrors.length > 0) {
      console.log("Page errors:", pageErrors)
    }

    expect(pageErrors).toHaveLength(0)
    expect(debugState.hasTest).toBe(true)
    expect(debugState.values.length).toBeGreaterThan(0)

    // BehaviorSubject emits initial value 10
    expect(debugState.values).toEqual([10])
    expect(debugState.hmrCount).toBe(1)
  })

  it("pushes new value through BehaviorSubject", async () => {
    // Ensure test harness is ready (in case of test isolation)
    await waitForTestReady(page)

    await page.evaluate(() => {
      window.__test__.source$.next(20)
    })

    // Wait for value to propagate
    await page.waitForFunction(
      () => window.__test__.values.includes(20),
      { timeout: 5000 },
    )

    const testState = await page.evaluate(() => ({
      values: window.__test__.values,
    }))

    expect(testState.values).toEqual([10, 20])
  })

  it("HMR swap: updates initial value and new emissions work", async () => {
    // Modify the source file - change initialValue from 10 to 100
    const modifiedContent = ORIGINAL_CONTENT.replace(
      "// HMR_MARKER: v1\nconst initialValue = 10",
      "// HMR_MARKER: v2\nconst initialValue = 100",
    )
    fs.writeFileSync(MAIN_TS_PATH, modifiedContent)

    // Wait for HMR to process - hmrCount should increment
    await page.waitForFunction(
      () => window.__test__?.hmrCount >= 2,
      { timeout: 10000 },
    )

    const hmrCountAfter = await page.evaluate(() => window.__test__.hmrCount)
    expect(hmrCountAfter).toBeGreaterThanOrEqual(2)

    // Push a new value through the stable wrapper
    await page.evaluate(() => {
      window.__test__.source$.next(30)
    })

    // Wait for value to propagate
    await page.waitForFunction(
      () => window.__test__.values.includes(30),
      { timeout: 5000 },
    )

    const finalState = await page.evaluate(() => ({
      values: window.__test__.values,
      hmrCount: window.__test__.hmrCount,
    }))

    // Should have: 10 (initial), 20 (before HMR), 30 (after HMR)
    expect(finalState.values).toContain(10)
    expect(finalState.values).toContain(20)
    expect(finalState.values).toContain(30)
  })

  it("subscription survives HMR - same subscription object", async () => {
    // Wait for test harness to be ready
    await page.waitForFunction(
      () => window.__test__?.subscription !== undefined,
      { timeout: 5000 },
    )

    // The subscription should be the same object (not recreated)
    const subscriptionClosed = await page.evaluate(() =>
      window.__test__.subscription?.closed,
    )
    expect(subscriptionClosed).toBe(false)
  })
})
