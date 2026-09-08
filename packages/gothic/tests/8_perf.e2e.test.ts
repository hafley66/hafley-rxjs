import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { chromium, type Page } from "playwright"
import { expect, it } from "vitest"

// the browser gun: rAF frames + long tasks over a 2s window while the page animates itself
async function aim(page: Page) {
  return page.evaluate(() => new Promise<{ fps: number; longtasks: number }>(resolve => {
    let frames = 0
    let longtasks = 0
    const t0 = performance.now()
    const po = new PerformanceObserver(list => { longtasks += list.getEntries().length })
    po.observe({ entryTypes: ["longtask"] })
    const tick = () => {
      frames++
      if (performance.now() - t0 < 2000) requestAnimationFrame(tick)
      else {
        po.disconnect()
        resolve({ fps: Math.round(frames / 2), longtasks })
      }
    }
    requestAnimationFrame(tick)
  }))
}

for (const route of ["fma", "slice", "circles"]) {
  it(`stress: /${route} animates without a long-task storm`, async () => {
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
      page.on("pageerror", error => { throw error })
      await page.goto(`${pathToFileURL(resolve("dist/index.html")).href}#/${route}`)
      // slice hides the source paths while its overlay runs, so wait on the svg itself
      await page.locator("section svg").first().waitFor({ state: "visible" })
      await page.waitForTimeout(1200)
      const gun = await aim(page)
      console.log(`gun /${route}`, gun)
      expect(gun.fps, `/${route} fps`).toBeGreaterThan(15)
      expect(gun.longtasks, `/${route} long tasks in 2s`).toBeLessThan(30)
    } finally {
      await browser.close()
    }
  })
}
