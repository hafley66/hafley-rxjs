import { mkdirSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { chromium } from "playwright"
import { expect, it } from "vitest"

it("plays, holds, drags, seeds and replays the three reliquaries through file URLs", async () => {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 })
    const errors: string[] = []
    page.on("pageerror", error => errors.push(error.message))
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()) })
    const base = pathToFileURL(resolve("dist/index.html")).href
    await page.goto(`${base}#/astrolabe?astrolabe.run=false&ossuary.run=false&lithic.run=false`)
    await page.waitForSelector('[data-art="lithic"] path')
    for (const name of ["astrolabe", "ossuary", "lithic"]) {
      const art = page.locator(`[data-art="${name}"]`)
      await art.scrollIntoViewIfNeeded()
      expect(await art.locator("path").count()).toBeGreaterThan(20)
      expect(await art.innerHTML()).not.toMatch(/NaN|Infinity/)
      expect(await art.getAttribute("viewBox")).toBe("-360 -360 720 720")
      if (process.env.ART_SCREENSHOTS) {
        mkdirSync(process.env.ART_SCREENSHOTS, { recursive: true })
        await art.screenshot({ path: resolve(process.env.ART_SCREENSHOTS, `${name}.png`), style: ".kit-top,.kit-drawer{visibility:hidden!important}" })
      }
    }
    const astro = page.locator('[data-art="astrolabe"]')
    await astro.scrollIntoViewIfNeeded()
    const oldRotor = await astro.locator('[data-layer="rotor"]').getAttribute("transform")
    const box = await astro.boundingBox()
    if (!box) throw new Error("missing astrolabe frame")
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.6)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6, { steps: 5 })
    await page.mouse.up()
    expect(await astro.locator('[data-layer="rotor"]').getAttribute("transform")).not.toBe(oldRotor)
    expect(page.url()).toContain("astrolabe.time=")
    const held = await astro.getAttribute("data-time")
    await page.reload()
    await page.waitForSelector('[data-art="astrolabe"]')
    expect(await astro.getAttribute("data-time")).toBe(held)
    const section = page.locator("section#astrolabe")
    await section.getByRole("button", { name: "Play", exact: true }).click()
    await page.waitForFunction(old => document.querySelector('[data-art="astrolabe"]')?.getAttribute("data-time") !== old, held)
    await section.getByRole("button", { name: "Hold", exact: true }).click()
    const paused = await astro.getAttribute("data-time")
    await page.waitForTimeout(150)
    expect(await astro.getAttribute("data-time")).toBe(paused)

    const lithic = page.locator('[data-art="lithic"]')
    await lithic.scrollIntoViewIfNeeded()
    await lithic.click({ position: { x: 400, y: 150 } })
    expect(page.url()).toContain("lithic.seed=18")
    await page.locator("#lithic").getByRole("button", { name: "Hold", exact: true }).click()
    const growth = await lithic.innerHTML()
    await page.reload()
    await page.waitForSelector('[data-art="lithic"]')
    expect(await lithic.innerHTML()).toBe(growth)
    await page.locator("#lithic select.kit-preset").selectOption("petrified")
    expect(await lithic.locator('[data-solid="1"]').count()).toBe(10)
    const narrow = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await narrow.goto(`${base}#/astrolabe?astrolabe.run=false&ossuary.run=false&lithic.run=false`)
    await narrow.waitForSelector('[data-art="astrolabe"]')
    expect(await narrow.locator('[data-art="astrolabe"]').evaluate(el => el.getBoundingClientRect().width)).toBeLessThanOrEqual(390)
    expect(errors).toEqual([])
  } finally {
    await browser.close()
  }
})
