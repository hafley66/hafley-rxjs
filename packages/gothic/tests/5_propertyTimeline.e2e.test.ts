import { resolve } from "node:path"
import { mkdirSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { chromium, type Locator } from "playwright"
import { expect, it } from "vitest"

const seek = (input: Locator, value: number) => input.evaluate((el, value) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(el, String(value))
  el.dispatchEvent(new Event("input", { bubbles: true }))
}, value)

it("edits inherited per-property timelines without writing animated frames into saved values or pins", async () => {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const errors: string[] = []
    page.on("pageerror", error => errors.push(error.message))
    await page.goto(`${pathToFileURL(resolve("dist/index.html")).href}#/fma?page.draw=false&fma2.n=3`)
    await page.waitForSelector("#fma2 svg path")
    const geometry = () => page.locator("#fma2 .row svg path").evaluateAll(paths => paths.map(p => p.getAttribute("d")))
    const original = await geometry()
    const saved = page.locator('#fma2 input[data-key="n"]')
    await page.locator('#fma2 input[data-pin="n"]').check()
    await page.locator("#fma2").getByRole("button", { name: "n animation settings", exact: true }).click()
    const editor = page.getByRole("dialog", { name: "n animation settings", exact: true })
    await editor.getByLabel("n row 1 value", { exact: true }).fill("3")
    await editor.getByLabel("n row 2 value", { exact: true }).fill("9")
    await editor.getByLabel("animate n", { exact: true }).check()
    await editor.getByText("Page timing", { exact: true }).click()
    await editor.getByLabel("page loop", { exact: true }).uncheck()
    await editor.getByText("Section timing", { exact: true }).click()
    await editor.getByLabel("section override duration", { exact: true }).check()
    await editor.getByLabel("section duration", { exact: true }).fill("2000")
    await seek(editor.getByLabel("Property timeline time", { exact: true }), 1000)
    await page.waitForFunction(() => document.querySelector("#fma2 .cell span")?.textContent?.includes("n6/"))
    expect(await saved.inputValue()).toBe("3")
    expect(await page.locator('#fma2 input[data-pin="n"]').isChecked()).toBe(true)
    await editor.getByLabel("field override duration", { exact: true }).check()
    await editor.getByLabel("field duration", { exact: true }).fill("1000")
    await page.waitForFunction(() => document.querySelector("#fma2 .cell span")?.textContent?.includes("n9/"))
    await editor.getByLabel("field override duration", { exact: true }).uncheck()
    await page.reload()
    await page.waitForFunction(() => document.querySelector("#fma2 .cell span")?.textContent?.includes("n6/"))
    expect(await saved.inputValue()).toBe("3")
    expect(await page.locator('#fma2 input[data-pin="n"]').isChecked()).toBe(true)
    await page.locator("#fma2").getByRole("button", { name: "n animation settings", exact: true }).click()
    await editor.getByRole("button", { name: "Restart", exact: true }).click()
    await page.waitForFunction(() => Number((document.querySelector('#timeline-fma-fma2-n [aria-label="Property timeline time"]') as HTMLInputElement)?.value) > 100)
    await editor.getByRole("button", { name: "Hold", exact: true }).click()
    expect(await saved.inputValue()).toBe("3")
    if (process.env.ART_SCREENSHOTS) {
      mkdirSync(process.env.ART_SCREENSHOTS, { recursive: true })
      await editor.screenshot({ path: resolve(process.env.ART_SCREENSHOTS, "property-timeline.png") })
    }
    await editor.getByRole("button", { name: "reset field", exact: true }).click()
    expect(await geometry()).toEqual(original)
    expect(errors).toEqual([])
  } finally { await browser.close() }
})

it("samples Slice path weight from its own table while the original Slice clock holds a frame", async () => {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const errors: string[] = []
    page.on("pageerror", error => errors.push(error.message))
    await page.goto(`${pathToFileURL(resolve("dist/index.html")).href}#/slice?slice.run=false&slice.time=1`)
    await page.waitForSelector(".ink path")
    await page.locator("#slice").getByRole("button", { name: "finalWeight animation settings", exact: true }).click()
    const editor = page.getByRole("dialog", { name: "finalWeight animation settings", exact: true })
    await editor.getByLabel("finalWeight row 1 value", { exact: true }).fill("1")
    await editor.getByLabel("finalWeight row 2 value", { exact: true }).fill("2")
    await editor.getByLabel("animate finalWeight", { exact: true }).check()
    await seek(editor.getByLabel("Property timeline time", { exact: true }), 2000)
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".ink path")!).strokeWidth === "1.5px")
    expect(await page.locator('#slice input[data-key="finalWeight"]').inputValue()).toBe("1")
    expect(await page.locator('#slice input[data-key="time"]').inputValue()).toBe("1")
    expect(await page.locator('#slice input[data-key="run"]').isChecked()).toBe(false)
    await editor.getByRole("button", { name: "reset field", exact: true }).click()
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".ink path")!).strokeWidth === "1px")
    expect(errors).toEqual([])
  } finally { await browser.close() }
})
