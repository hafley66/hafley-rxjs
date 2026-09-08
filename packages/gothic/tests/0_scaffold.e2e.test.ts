import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { chromium } from "playwright"
import { expect, it } from "vitest"
import { scaffoldFixture } from "../scripts/0_fixture.js"

it("a scaffolded notebook renders kit controls, isolates composed sections, and persists signal edits", async () => {
  const fixture = scaffoldFixture()
  try {
    const commands = [
      ["page", "scaffold_receipt"],
      ...["range", "number", "seed", "select", "bool", "text"].map(kind => ["input", "scaffold_receipt", `field_${kind}`, kind]),
      ["use", "scaffold_receipt", "comparison", "2_fma:fma2"],
      ["use", "scaffold_receipt", "second", "2_fma:fma2"],
      ["section", "fma", "scaffold_append"],
    ]
    for (const args of commands) expect(fixture.run(...args)).toMatchObject({ status: 0, stderr: "" })
    const build = fixture.command("pnpm", ["build:single"])
    expect(build.status, build.stdout + build.stderr).toBe(0)
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
      const errors: string[] = []
      page.on("pageerror", error => errors.push(error.message))
      page.on("console", message => { if (message.type() === "error") errors.push(message.text()) })
      const url = pathToFileURL(join(fixture.cwd, "dist/index.html")).href
      await page.goto(`${url}#/scaffold_receipt?scaffold_receipt.radius=0.2&comparison.n=3&second.n=5&page.draw=false`)
      await page.waitForSelector("#scaffold_receipt svg path")
      expect(await page.locator("main > .kit-section").evaluateAll(els => els.map(el => el.id))).toMatchInlineSnapshot(`
        [
          "scaffold_receipt",
          "comparison",
          "second",
        ]
      `)
      expect(await page.locator("#scaffold_receipt .kit-row").evaluateAll(rows => rows.map(row => ({
        kind: row.getAttribute("data-kind"), titled: Boolean((row as HTMLElement).title),
      })))).toMatchInlineSnapshot(`
        [
          {
            "kind": "range",
            "titled": true,
          },
          {
            "kind": "range",
            "titled": true,
          },
          {
            "kind": "number",
            "titled": true,
          },
          {
            "kind": "seed",
            "titled": true,
          },
          {
            "kind": "select",
            "titled": true,
          },
          {
            "kind": "bool",
            "titled": true,
          },
          {
            "kind": "text",
            "titled": true,
          },
        ]
      `)
      const radius = page.locator('#scaffold_receipt input[data-key="radius"]')
      expect(await radius.inputValue()).toBe("0.2")
      const otherPaths = await page.locator("#comparison svg path, #second svg path").evaluateAll(paths => paths.map(p => p.getAttribute("d")))
      const before = await page.locator("#scaffold_receipt svg path").first().getAttribute("d")
      await radius.evaluate(el => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(el, "0.4")
        el.dispatchEvent(new Event("input", { bubbles: true }))
      })
      await page.waitForFunction(() => location.hash.includes("scaffold_receipt.radius=0.4"))
      expect(await page.locator("#scaffold_receipt svg path").first().getAttribute("d")).not.toBe(before)
      expect(await page.locator("#comparison svg path, #second svg path").evaluateAll(paths => paths.map(p => p.getAttribute("d")))).toEqual(otherPaths)
      await page.locator('#scaffold_receipt input.kit-pin[data-pin="radius"]').check()
      const named = page.locator("#scaffold_receipt .kit-combo input")
      await named.fill("receipt")
      await named.press("Enter")
      const beforeShuffle = page.url()
      await page.locator("#scaffold_receipt .kit-shuffle").click()
      expect(await radius.inputValue()).toBe("0.4")
      expect(page.url()).not.toBe(beforeShuffle)
      await page.goBack()
      expect(page.url()).toBe(beforeShuffle)
      await radius.evaluate(el => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(el, "0.25")
        el.dispatchEvent(new Event("input", { bubbles: true }))
      })
      await page.waitForFunction(() => location.hash.includes("scaffold_receipt.radius=0.25"))
      await page.reload()
      await radius.waitFor()
      expect(await radius.inputValue()).toBe("0.25")
      expect(await named.inputValue()).toBe("receipt")
      expect(await page.locator("#scaffold_receipt .kit-sync").textContent()).toBe("●")
      const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("gothic.scaffold_receipt.scaffold_receipt.states") ?? "[]"))
      expect(stored[0].vals.radius).toBe(0.25)
      await page.goto(`${url}#/fma?page.draw=false`)
      await page.waitForSelector("#scaffold_append svg path")
      expect(await page.locator("main > .kit-section").evaluateAll(els => els.map(el => el.id))).toEqual(
        expect.arrayContaining(["fma2", "gallery", "scaffold_append"]),
      )
      expect(errors).toEqual([])
    } finally {
      await browser.close()
    }
  } finally {
    fixture.unsubscribe()
  }
})
