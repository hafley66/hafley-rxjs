import path from "path"
import { chromium, type Browser, type Page } from "playwright"
import { createServer, type ViteDevServer } from "rolldown-vite"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const FIXTURE_DIR = path.join(__dirname, "fixture-kitchen-sink")

describe("Kitchen Sink - All RxJS Patterns", () => {
  let server: ViteDevServer
  let browser: Browser
  let page: Page
  let serverUrl: string

  beforeAll(async () => {
    // Start Vite dev server
    server = await createServer({
      configFile: path.join(FIXTURE_DIR, "vite.config.ts"),
      server: { port: 0 },
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

    // Log console for debugging
    page.on("console", msg => {
      if (msg.type() === "log") {
        console.log(`[browser] ${msg.text()}`)
      }
    })
    page.on("pageerror", err => {
      console.error(`[browser error] ${err.message}`)
    })
  }, 30000)

  afterAll(async () => {
    await page?.close()
    await browser?.close()
    await server?.close()
  })

  it("collects correct values from all observable types", async () => {
    const errors: string[] = []
    page.on("pageerror", err => errors.push(err.message))

    await page.goto(serverUrl)

    // Wait for page to load and subscriptions to complete
    await new Promise(r => setTimeout(r, 1000))

    // Debug: check what's on window
    const windowKeys = await page.evaluate(() =>
      Object.keys(window).filter(k => k.startsWith("__"))
    )
    console.log("Window keys:", windowKeys)
    console.log("Page errors:", errors)

    const hasKitchenSink = await page.evaluate(() => !!window.__kitchen_sink__)
    if (!hasKitchenSink) {
      throw new Error(`__kitchen_sink__ not found. Window keys: ${windowKeys.join(", ")}. Errors: ${errors.join("; ")}`)
    }

    const values = await page.evaluate(() => window.__kitchen_sink__.values)

    expect(values).toMatchInlineSnapshot(`
      {
        "cold": [
          100,
          200,
        ],
        "combined": [
          [
            1,
            2,
            3,
          ],
        ],
        "defer": [
          "deferred",
        ],
        "from": [
          4,
          5,
          6,
        ],
        "merged": [
          "a",
          "b",
          "c",
        ],
        "nested": [
          0,
          4,
        ],
        "of": [
          1,
          2,
          3,
        ],
        "piped": [
          10,
        ],
        "shared": [
          100,
          200,
        ],
        "switched": [
          100,
          200,
        ],
      }
    `)
  })

  it.skip("tracking state captures all observables and subscriptions", async () => {
    // TODO: expose debugger state to window via plugin alias
  })

  it.skip("pushing values through subjects updates downstream", async () => {
    // Push new value through BehaviorSubject
    await page.evaluate(() => {
      window.__kitchen_sink__.behaviorSubject$.next(5)
    })

    await new Promise(r => setTimeout(r, 100))

    const pipedValues = await page.evaluate(
      () => window.__kitchen_sink__.values.piped,
    )
    const nestedValues = await page.evaluate(
      () => window.__kitchen_sink__.values.nested,
    )

    // piped: 1*10=10, then 5*10=50
    expect(pipedValues).toEqual([10, 50])
    // nested: startWith(0), then (1+1)*2=4, then startWith(0), then (5+1)*2=12
    expect(nestedValues).toEqual([0, 4, 0, 12])
  })
})
