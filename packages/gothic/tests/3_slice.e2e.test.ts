import { mkdirSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { chromium } from "playwright"
import { build } from "vite"
import react from "@vitejs/plugin-react"
import { signalsJsx } from "@hafley66/signals/vite"
import { expect, it } from "vitest"

it("attaches the slice toolkit to arbitrary mounted SVGs and restores originals after seeking and teardown", async () => {
  const result = await build({ configFile: false, logLevel: "silent",
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    resolve: { alias: [{ find: /^@hafley66\/report-shell$/, replacement: resolve("../report-shell/src/index.ts") }] },
    build: { write: false, minify: false, lib: { entry: resolve("src/kit/slice/index.ts"), name: "SliceKit", formats: ["iife"] } },
  })
  const output = (Array.isArray(result) ? result[0] : result).output
  const code = output.filter(chunk => chunk.type === "chunk").map(chunk => chunk.code).join("\n")
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 800 } })
    const errors: string[] = []
    page.on("pageerror", error => errors.push(error.message))
    await page.setContent(`<svg id="art" width="500" height="400" viewBox="0 0 160 120">
      <defs><clipPath id="clip"><rect width="140" height="100"/></clipPath></defs>
      <g transform="translate(10 10)" style="stroke:#b85b32;stroke-width:2;fill:none" clip-path="url(#clip)">
        <path id="curve" d="m0 45q15 -45 30 0t30 0m15 0c0 -40 25 -40 25 0s25 40 25 0"/>
        <circle cx="30" cy="80" r="15"/><rect x="65" y="70" width="25" height="20" rx="4" style="fill:#526d77;stroke:none"/>
        <polygon points="105,70 130,75 120,100"/>
        <ellipse cx="25" cy="25" rx="12" ry="8"/>
        <line x1="55" y1="10" x2="90" y2="25"/>
        <polyline points="100,10 115,30 130,10"/>
      </g></svg>`)
    await page.addScriptTag({ content: code })
    expect(errors).toEqual([])
    const original = await page.locator("#art").innerHTML()
    const receipt = await page.evaluate(() => {
      const w = window as any
      w.animation = w.SliceKit.attachSlice(document.querySelector("#art"), { run: false, reducedMotion: false, loop: false, reveal: "cut", cut: 16 })
      w.observer = w.animation.frame.$.subscribe()
      w.animation.seek(180)
      return { sources: document.querySelectorAll("[data-slice-overlay]").length, strokes: w.animation.frame.timeline.$().strokes.length,
        finite: w.animation.frame.timeline.$().strokes.every((s: any) => s.pts.every((p: number[]) => p.every(Number.isFinite))),
        hidden: getComputedStyle(document.querySelector("#curve")!).visibility }
    })
    expect(receipt.sources).toBe(7)
    expect(receipt.strokes).toBeGreaterThan(10)
    expect([receipt.finite, receipt.hidden]).toEqual([true, "hidden"])
    expect(await page.locator("defs [data-slice-overlay]").count()).toBe(0)
    await page.evaluate(() => { const a = (window as any).animation; a.seek(a.frame.timeline.T.$()) })
    expect(await page.locator("#curve").evaluate(el => getComputedStyle(el).visibility)).toBe("visible")
    await page.evaluate(() => { const a = (window as any).animation; a.params.finalWeight.$(0.5); a.params.weight.$(2) })
    expect(await page.locator("#curve").evaluate(el => getComputedStyle(el).strokeWidth)).toBe("1px")
    await page.evaluate(() => (window as any).animation.seek(0))
    expect(await page.locator("[data-slice-overlay]").first().locator("path").last().evaluate(el => getComputedStyle(el).strokeWidth)).toBe("4px")
    await page.evaluate(() => (window as any).observer.unsubscribe())
    expect(await page.locator("#art").innerHTML()).toBe(original)
    await page.evaluate(() => {
      const w = window as any
      w.animation = w.SliceKit.attachSlice(document.querySelector("#art"), { reducedMotion: true })
      w.observer = w.animation.frame.$.subscribe()
    })
    expect(await page.locator("#curve").evaluate(el => getComputedStyle(el).visibility)).toBe("visible")
    await page.evaluate(() => {
      const a = (window as any).animation
      a.params.reveal.$("draw+slide")
      a.replay()
    })
    await page.waitForFunction(() => (window as any).animation.frame.time.$() > 20)
    await page.evaluate(() => (window as any).observer.unsubscribe())
    expect(await page.locator("#art").innerHTML()).toBe(original)
    expect(errors).toEqual([])
  } finally { await browser.close() }
})

it("renders the five FMA additions and keeps playback static and exposes locks and rerolls on geometry fields", async () => {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
    const errors: string[] = []
    page.on("pageerror", error => errors.push(error.message))
    await page.goto(`${pathToFileURL(resolve("dist/index.html")).href}#/fma?page.draw=false`)
    await page.waitForSelector("#resonance svg path")
    expect(await page.locator("section.kit-section").count()).toBe(8)
    expect(await page.locator(".kit-front input[data-key=run]").count()).toBe(1)
    const fields = await page.locator(".kit-drawer .kit-row").count()
    expect(await page.locator(".kit-row input[data-pin]").count()).toBe(fields)
    expect(await page.locator(".kit-row button.kit-roll").count()).toBe(fields)
    const pupil = page.locator('#fma2 input[data-key="pupil"]')
    const value = await pupil.isChecked()
    await page.locator('#fma2 input[data-pin="pupil"]').check()
    await page.locator("#fma2 button.kit-shuffle").click()
    expect(await pupil.isChecked()).toBe(value)
    await page.reload()
    await page.waitForSelector("#resonance svg path")
    expect(await page.locator('#fma2 input[data-pin="pupil"]').isChecked()).toBe(true)
    for (const id of ["envelope", "braid", "conformal", "cells", "resonance"]) {
      const section = page.locator(`#${id}`)
      await section.evaluate(el => { for (const animation of el.getAnimations({ subtree: true })) animation.finish() })
      expect(await section.locator("input[data-pin]").count()).toBe(4)
      if (process.env.ART_SCREENSHOTS) {
        mkdirSync(process.env.ART_SCREENSHOTS, { recursive: true })
        await section.locator(".row").screenshot({ path: resolve(process.env.ART_SCREENSHOTS, `fma-${id}.png`), style: ".kit-top,.kit-drawer{visibility:hidden!important}" })
      }
    }
    await page.goto(`${pathToFileURL(resolve("dist/index.html")).href}#/slice?slice.run=false`)
    await page.waitForSelector(".ink path")
    expect(await page.locator(".kit-front input[data-key=run]").count()).toBe(1)
    await page.locator("#slice select.kit-preset").selectOption("frame · end")
    await page.waitForFunction(() => [...document.querySelectorAll<SVGPathElement>(".ink path")].every(path => path.style.opacity === "1" && path.style.strokeDashoffset === "0"))
    await page.locator("#slice select.kit-preset").selectOption("frame · middle")
    expect(page.url()).toContain("slice.time=0.5")
    const heldSlice = await page.locator(".ink").first().innerHTML()
    await page.reload()
    await page.waitForFunction(() => Number((document.querySelector('[aria-label="Slice time"]') as HTMLInputElement)?.value) > 0)
    expect(await page.locator(".ink").first().innerHTML()).toBe(heldSlice)
    await page.locator("#slice").getByRole("button", { name: "Restart", exact: true }).click()
    await page.waitForFunction(() => Number((document.querySelector('[aria-label="Slice time"]') as HTMLInputElement)?.value) > 20)
    await page.locator("#slice").getByRole("button", { name: "Hold", exact: true }).click()
    expect(await page.locator('#slice input[data-key="run"]').isChecked()).toBe(false)
    expect(errors).toEqual([])
  } finally { await browser.close() }
})

it("connects through plain JSX reads and restores SVG when the reader drops the signal or unmounts", async () => {
  const result = await build({ configFile: false, logLevel: "silent", plugins: [react(), signalsJsx()],
    define: { "process.env.NODE_ENV": JSON.stringify("development") },
    build: { write: false, minify: false, lib: { entry: resolve("tests/fixtures/0_slice.tsx"), name: "SliceFixture", formats: ["iife"] } },
  })
  const output = (Array.isArray(result) ? result[0] : result).output
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    const errors: string[] = []
    page.on("pageerror", e => errors.push(e.message))
    await page.setContent('<div id="root"></div>')
    await page.addScriptTag({ content: output.filter(c => c.type === "chunk").map(c => c.code).join("\n") })
    await page.evaluate(() => { const w = window as any; w.fixture = w.SliceFixture.mount(document.querySelector("#root"), false) })
    await page.waitForSelector("[data-slice-overlay]")
    expect(await page.locator("[data-slice-overlay]").count()).toBe(1)
    expect(await page.evaluate(() => { const f = (window as any).fixture; return f.animation.params === f.state.params })).toBe(true)
    await page.evaluate(() => (window as any).fixture.animation.seek(200))
    await page.waitForFunction(() => document.querySelector("svg")?.getAttribute("data-time") === "200")
    await page.evaluate(() => (window as any).fixture.state.revision.$(1))
    await page.waitForFunction(() => document.querySelector("[data-source]")?.getAttribute("d") === "M10 50H190")
    expect(await page.locator("[data-slice-overlay]").count()).toBe(1)
    await page.evaluate(() => (window as any).fixture.state.observe.$(false))
    await page.waitForFunction(() => document.querySelectorAll("[data-slice-overlay]").length === 0)
    expect(await page.locator("[data-source]").evaluate(el => getComputedStyle(el).visibility)).toBe("visible")
    expect(await page.locator("[data-source]").getAttribute("style")).toBe(null)
    await page.evaluate(() => (window as any).fixture.state.observe.$(true))
    await page.waitForSelector("[data-slice-overlay]")
    await page.evaluate(() => (window as any).fixture.animation.replay())
    await page.waitForFunction(() => Number(document.querySelector("svg")?.getAttribute("data-time")) > 200)
    const before = Number(await page.locator("svg").getAttribute("data-time"))
    await page.evaluate(() => (window as any).fixture.state.revision.$(0))
    await page.waitForFunction(() => document.querySelector("[data-source]")?.getAttribute("d") === "M10 50Q50 0 100 50T190 50")
    expect(Number(await page.locator("svg").getAttribute("data-time"))).toBeGreaterThanOrEqual(before)
    await page.evaluate(() => (window as any).fixture.unsubscribe())
    expect(await page.locator("#root").innerHTML()).toBe("")
    expect(errors).toEqual([])
  } finally { await browser.close() }
})
