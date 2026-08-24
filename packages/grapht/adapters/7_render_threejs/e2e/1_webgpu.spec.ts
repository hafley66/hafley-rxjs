import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { expect, test } from "@playwright/test"

const receiptsDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "receipts")

type ThreeReceipt = {
  status: string
  renderer: string
  representation: string
  visualValidity?: { valid: boolean; actualBackend: string; requestedRenderer: string; nonBackgroundPixels: number }
  webgpuProbe?: { available: boolean; reason?: string; adapter?: { vendor: string; architecture: string; device: string } }
  evidenceVisualValid?: string
  reason?: string
}

for (const representation of ["retained", "particles"]) {
  test(`renders grid-1k through Three.js WebGPU or reports it unavailable with WebGL evidence (${representation})`, async ({ page }) => {
    const errors: string[] = []
    page.on("pageerror", error => errors.push(error.stack ?? error.message))
    await page.goto(`/?nodes=1000&renderer=webgpu&representation=${representation}&pause=1`)

    await expect(page.locator("#three-container[data-receipt-status='ready'], #three-container[data-receipt-status='webgpu-unavailable']"), errors.join("\n")).toHaveCount(1, { timeout: 40_000 })
    await mkdir(receiptsDir, { recursive: true })
    await page.screenshot({ path: join(receiptsDir, `webgpu-${representation}.png`) })
    await page.evaluate(() => window.dispatchEvent(new Event("grapht-continue")))

    const receipt = page.locator("#receipt")
    await expect(receipt, errors.join("\n")).toHaveText(/\S+/, { timeout: 40_000 })
    const value = JSON.parse(await receipt.textContent() ?? "{}") as ThreeReceipt

    if (value.status === "healthy") {
      expect(value.visualValidity?.valid).toBe(true)
      expect(value.visualValidity?.nonBackgroundPixels).toBeGreaterThan(0)
      expect(value.visualValidity?.actualBackend).toBe("webgpu")
      expect(value.visualValidity?.requestedRenderer).toBe("webgpu")
      expect(value.webgpuProbe?.available).toBe(true)
    } else {
      expect(value.status).toBe("webgpu-unavailable")
      expect(value.reason).toBeTruthy()
      expect(value.webgpuProbe).toBeTruthy()
      expect(value.webgpuProbe?.available).toBe(false)
      expect(value.webgpuProbe?.reason).toBeTruthy()
    }

    await writeFile(join(receiptsDir, `webgpu-${representation}.receipt.json`), JSON.stringify(value, null, 2), "utf8")
  })
}
