import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { chromium } from "playwright"
import { expect, it } from "vitest"

it("draw-in off reveals every FMA path immediately; enabled staggering has a bounded start window", async () => {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    const errors: string[] = []
    page.on("pageerror", error => errors.push(error.message))
    await page.goto(`${pathToFileURL(resolve("dist/index.html")).href}#/fma?page.draw=false&fma2.depth=3&fma2.minPx=1`)
    await page.waitForSelector("#fma2 svg path")
    const styles = await page.locator("#fma2 svg path:not(defs path)").evaluateAll(paths => paths.map(path => {
      const css = getComputedStyle(path)
      return [css.animationDelay, css.strokeDashoffset, css.opacity]
    }))
    expect(styles.length).toBeGreaterThan(160)
    expect([...new Set(styles.map(style => style.join("|")))]).toEqual(["0s|0px|1"])
    await page.locator("#kit-page-draw").check()
    const delays = await page.locator("#fma2 svg path").evaluateAll(paths => paths.map(path => parseFloat(getComputedStyle(path).animationDelay)))
    expect(Math.max(...delays)).toBe(0.8)
    expect(errors).toEqual([])
  } finally { await browser.close() }
})
