import { chromium, type Browser } from "playwright"
import { afterAll, beforeAll, describe, expect, test } from "vitest"
import { createServer, type ViteDevServer } from "vite"

let browser: Browser
let server: ViteDevServer
let serverUrl = ""

beforeAll(async () => {
  server = await createServer({ configFile: "packages/grapht/vite.sequence-demo.config.ts", logLevel: "error" })
  await server.listen()
  const address = server.httpServer?.address()
  if (!address || typeof address === "string") throw new Error("sequence demo server did not expose a TCP address")
  serverUrl = `http://127.0.0.1:${address.port}`
  browser = await chromium.launch({ headless: true })
})

afterAll(async () => {
  await browser?.close()
  await server?.close()
})

describe("sequence demo", () => {
  test("switches between public Mermaid and D2 board inputs", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 })
    await page.goto(serverUrl)
    await page.locator('[data-status][data-state="ready"]').waitFor({ timeout: 60_000 })

    const mermaid = await page.locator("[data-status]").textContent()
    await page.locator("[data-language]").selectOption("d2")
    await page.locator('[data-status][data-state="ready"]').waitFor({ timeout: 60_000 })
    const d2 = await page.locator("[data-status]").textContent()
    await page.locator("[data-occurrence]").selectOption({ index: 8 })
    await page.locator("[data-camera-y]").fill("-120")
    const receiptText = await page.locator("[data-receipt]").textContent()
    if (!receiptText) throw new Error("sequence demo receipt was empty")

    expect({
      mermaid,
      d2,
      boardCount: await page.locator("[data-sequence-board]").count(),
      actorLabels: await page.locator("[data-sequence-actor-label]").count(),
      occurrenceOptions: await page.locator("[data-occurrence] option").count(),
      receipt: JSON.parse(receiptText),
    }).toMatchInlineSnapshot(`
      {
        "actorLabels": 3,
        "boardCount": 1,
        "d2": "d2 ready · 11 occurrences",
        "mermaid": "mermaid ready · 11 occurrences",
        "occurrenceOptions": 11,
        "receipt": {
          "actorLabelIds": [
            "d2:49a15df1:actor:alice#0",
            "d2:49a15df1:actor:bob#1",
            "d2:49a15df1:actor:archive#2",
          ],
          "camera": {
            "scale": 1,
            "x": 0,
            "y": -120,
          },
          "focus": {
            "actorIds": [
              "d2:49a15df1:actor:alice#0",
              "d2:49a15df1:actor:bob#1",
            ],
            "groupIds": [
              "d2:49a15df1:group:outer exchange#0",
              "d2:49a15df1:group:nested review#1",
            ],
            "hoveredOccurrenceId": "d2:49a15df1:edge:alice->bob.work:repeat#6",
          },
          "focusOverlayActorIds": [],
          "geometryId": "geometry:65ed6bd7",
          "listenerCount": 2,
          "mounted": true,
          "renderRevisionId": "render:65e979a0",
        },
      }
    `)

    await page.close()
  }, 120_000)
})
