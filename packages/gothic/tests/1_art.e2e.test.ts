import { mkdirSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { chromium } from "playwright"
import { expect, it } from "vitest"

it("renders the architectural studies and guilloche presets as finite SVG geometry", async () => {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 })
    const errors: string[] = []
    page.on("pageerror", error => errors.push(error.message))
    const url = pathToFileURL(resolve("dist/index.html")).href
    await page.goto(`${url}#/architecture?page.draw=false`)
    await page.waitForSelector("#cloister svg path")
    const receipt = []
    for (const id of ["architecture", "fanvault", "buttresses", "spires", "wheel", "cloister"]) {
      const section = page.locator(`section#${id}`)
      await section.evaluate(el => { for (const animation of el.getAnimations({ subtree: true })) animation.finish() })
      const last = section.locator("svg").last()
      receipt.push({ id, paths: await last.locator("path").count(), box: await last.evaluate(el => {
        const box = (el as SVGSVGElement).getBBox()
        return [box.x, box.y, box.width, box.height].map(n => Math.round(n))
      }) })
      if (process.env.ART_SCREENSHOTS) {
        mkdirSync(process.env.ART_SCREENSHOTS, { recursive: true })
        await section.locator(".row").screenshot({ path: resolve(process.env.ART_SCREENSHOTS, `${id}.png`), style: ".kit-top, .kit-drawer { visibility: hidden !important; }" })
      }
    }
    expect(receipt).toMatchSnapshot()
    await page.goto(`${url}#/guilloche?page.draw=false`)
    await page.waitForSelector("#guilloche svg path")
    for (const preset of ["engraving", "cathedral", "solar", "lacework"]) {
      await page.locator("#guilloche select.kit-preset").selectOption(preset)
      await page.waitForFunction(() => [...document.querySelectorAll("#guilloche path")].every(p => !/NaN|Infinity/.test(p.getAttribute("d") ?? "")))
      await page.locator("#guilloche").evaluate(el => { for (const animation of el.getAnimations({ subtree: true })) animation.finish() })
      expect(await page.locator("#guilloche svg").count()).toBe(3)
      if (process.env.ART_SCREENSHOTS) await page.locator("#guilloche .row").screenshot({ path: resolve(process.env.ART_SCREENSHOTS, `guilloche-${preset}.png`) })
    }
    expect(errors).toEqual([])
  } finally {
    await browser.close()
  }
})
