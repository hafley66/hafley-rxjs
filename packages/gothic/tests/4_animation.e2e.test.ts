import { resolve } from "node:path"
import { mkdirSync } from "node:fs"
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
    await page.goto(`${pathToFileURL(resolve("dist/index.html")).href}#/architecture?page.draw=true`)
    await page.waitForSelector(".kit-draw path")
    const delays = await page.locator(".kit-draw path").evaluateAll(paths => paths.map(path => parseFloat(getComputedStyle(path).animationDelay)))
    expect(Math.max(...delays)).toBe(0.8)
    expect(errors).toEqual([])
  } finally { await browser.close() }
})

it("keeps the original Slice selectable, changes only geometry for core presets, and makes inscriptions opt-in", async () => {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const errors: string[] = []
    page.on("pageerror", error => errors.push(error.message))
    const url = pathToFileURL(resolve("dist/index.html")).href
    await page.goto(`${url}#/slice?slice.run=false&slice.time=1`)
    await page.waitForSelector(".ink path")
    const drawing = () => page.locator(".ink").first().innerHTML()
    const original = await drawing()
    const shapes = []
    for (const core of ["iris", "opposed blades", "rung lattice"]) {
      await page.locator("#slice select.kit-preset").selectOption(`core · ${core}`)
      shapes.push(await drawing())
      expect(page.url()).toContain("slice.time=1")
      expect(await page.locator('#slice input[data-key="run"]').isChecked()).toBe(false)
      if (process.env.ART_SCREENSHOTS) {
        mkdirSync(process.env.ART_SCREENSHOTS, { recursive: true })
        await page.locator("#slice .row").first().screenshot({ path: resolve(process.env.ART_SCREENSHOTS, `slice-${core.replaceAll(" ", "-")}.png`), style: ".kit-top,.kit-drawer{visibility:hidden!important}" })
      }
    }
    expect(new Set([original, ...shapes]).size).toBe(4)
    await page.locator("#slice select.kit-preset").selectOption("core · original")
    expect(await drawing()).toBe(original)
    for (const route of ["fma", "circles"]) {
      await page.goto(`${url}#/${route}?page.draw=false`)
      await page.waitForSelector(".kit-section svg")
      expect(await page.locator(".kit-section svg text").evaluateAll(texts => texts.filter(t => getComputedStyle(t).display !== "none").length)).toBe(0)
      const id = route === "fma" ? "fma2" : "diagram"
      await page.locator(`#${id} input[data-key="script"]`).check()
      expect(await page.locator(`#${id} svg text`).evaluateAll(texts => texts.filter(t => getComputedStyle(t).display !== "none").length)).toBeGreaterThan(0)
    }
    expect(errors).toEqual([])
  } finally { await browser.close() }
})

it("uses Slice on every FMA and circles drawing with deterministic seeking, replay, and geometry replacement", async () => {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const errors: string[] = []
    page.on("pageerror", error => errors.push(error.message))
    for (const [route, stages] of [["fma", 7], ["circles", 3]] as const) {
      await page.goto(`${pathToFileURL(resolve("dist/index.html")).href}#/${route}?page.draw=true&timing.run=false&timing.time=0`)
      await page.waitForSelector("[data-slice-overlay]")
      expect(await page.locator("[data-slice-stage]").count()).toBe(stages)
      const receipts = await page.locator("[data-slice-stage]").evaluateAll(stages => stages.map(stage => ({
        sources: stage.querySelectorAll("[data-slice-overlay]").length,
        cssClocks: stage.getAnimations({ subtree: true }).length,
      })))
      expect(receipts.every(r => r.sources > 0 && r.cssClocks === 0)).toBe(true)
      await page.locator("#timing select.kit-preset").selectOption("frame · middle")
      const selector = "[data-slice-overlay] path"
      const pose = () => page.locator(selector).evaluateAll(paths => paths.slice(0, 400).map(p => p.getAttribute("style")))
      const middle = await pose()
      await page.locator("#timing select.kit-preset").selectOption("frame · end")
      expect(await page.locator("[data-slice-overlay]").evaluateAll(groups => groups.every(g => (g as SVGElement).style.display === "none"))).toBe(true)
      await page.locator("#timing select.kit-preset").selectOption("frame · middle")
      expect(await pose()).toEqual(middle)
      const stage = page.locator("[data-slice-stage]").first()
      await stage.getByRole("button", { name: "Restart", exact: true }).click()
      await page.waitForFunction(() => Number((document.querySelector('[data-slice-stage] input[type="range"]') as HTMLInputElement)?.value) > 20)
      await stage.getByRole("button", { name: "Hold", exact: true }).click()
      expect(await page.locator('#timing input[data-key="run"]').isChecked()).toBe(false)
      const id = route === "fma" ? "fma2" : "diagram"
      await page.locator(`#${id} .kit-row[data-kind=seed] button.kit-roll`).click()
      await page.waitForSelector(`#${id} [data-slice-overlay]`, { state: "attached" })
      await page.locator("#kit-page-draw").uncheck()
      expect(await page.locator("[data-slice-overlay]").count()).toBe(0)
      expect(errors).toEqual([])
    }
  } finally { await browser.close() }
})
