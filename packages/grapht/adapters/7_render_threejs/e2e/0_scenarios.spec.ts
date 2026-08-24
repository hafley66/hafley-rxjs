import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { expect, test } from "@playwright/test"

const receiptsDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "receipts")

type ThreeReceipt = {
  status: string
  renderer: string
  representation: string
  fixture: string
  visualValidity?: {
    valid: boolean
    nonBackgroundPixels: number
    actualBackend: string
    requestedRenderer: string
  }
  scenarios: { scenario: string; sample: { support: string; reason?: string } }[]
  reason?: string
}

async function capture(page: import("@playwright/test").Page, file: string): Promise<ThreeReceipt> {
  const text = await page.locator("#receipt").textContent()
  return JSON.parse(text ?? "{}") as ThreeReceipt
}

for (const representation of ["retained", "particles"]) {
  test(`renders grid-1k through Three.js WebGL (${representation}) and records a PNG + JSON receipt`, async ({ page }) => {
    const errors: string[] = []
    page.on("pageerror", error => errors.push(error.stack ?? error.message))
    await page.goto(`/?nodes=1000&renderer=webgl&representation=${representation}&pause=1`)
    await expect(page.locator("#three-container[data-visual-valid='true']"), errors.join("\n")).toHaveCount(1, { timeout: 40_000 })
    await expect(page.locator("#three-container[data-actual-backend='webgl']"), errors.join("\n")).toHaveCount(1)

    await mkdir(receiptsDir, { recursive: true })
    await page.screenshot({ path: join(receiptsDir, `webgl-${representation}.png`) })

    await page.evaluate(() => window.dispatchEvent(new Event("grapht-continue")))
    const receipt = page.locator("#receipt")
    await expect(receipt, errors.join("\n")).toHaveText(/\S+/, { timeout: 40_000 })
    const value = await capture(page, `webgl-${representation}`)
    expect(value.status).toBe("healthy")
    expect(value.visualValidity?.valid).toBe(true)
    expect(value.visualValidity?.nonBackgroundPixels).toBeGreaterThan(0)
    expect(value.visualValidity?.actualBackend).toBe("webgl")
    expect(value.scenarios.map(item => item.scenario)).toContain("camera-pan")
    expect(value.scenarios.map(item => item.scenario)).toContain("graph-dispose")
    expect(value.scenarios.every(item => item.sample.support === "supported" || item.sample.support === "unsupported")).toBe(true)

    await writeFile(join(receiptsDir, `webgl-${representation}.receipt.json`), JSON.stringify(value, null, 2), "utf8")
  })
}
