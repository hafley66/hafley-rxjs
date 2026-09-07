// App-level receipt over the built single file: raw playwright against dist/index.html from file://
// (hash routing), no dev server, same harness shape as vitest-telemetry/tests. `pnpm check` builds first.
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { type Browser, chromium, type Page } from "playwright"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const SINGLE = resolve(import.meta.dirname, "../dist/index.html")
if (!existsSync(SINGLE)) throw new Error(`missing ${SINGLE}: run \`pnpm build:single\` in packages/gothic first`)

let browser: Browser
let page: Page
const pageErrors: string[] = []
let tabs: string[] = []

const go = async (tab: string) => {
  await page.goto(`file://${SINGLE}#/${tab}`)
  await page.waitForSelector("header a[data-tab]")
  await page.waitForTimeout(600)
}
const tabX = () => page.$$eval("header a[data-tab]", as => as.map(a => Math.round(a.getBoundingClientRect().x)))
// React reads inputs through its value tracker, so writes go through the prototype setter before the event
const setRange = (sel: string, v: string) =>
  page.$eval(
    sel,
    (el, v) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(el, v)
      el.dispatchEvent(new Event("input", { bubbles: true }))
    },
    v,
  )

beforeAll(async () => {
  browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1200, height: 800 } })
  page = await context.newPage()
  page.on("pageerror", e => pageErrors.push(`${page.url()} ${e.message}`))
  page.on("console", m => m.type() === "error" && pageErrors.push(`${page.url()} ${m.text()}`))
  await go("eye")
  tabs = await page.$$eval("header a[data-tab]", as => as.map(a => (a as HTMLElement).dataset.tab ?? ""))
})
afterAll(async () => {
  await browser.close()
})

describe("gothic single file", () => {
  it("every tab renders svg, keeps the tab row fixed, mounts the drawer, and titles every control", async () => {
    expect(tabs.length).toBeGreaterThan(5)
    const x0 = await tabX()
    const rows: string[] = []
    for (const t of tabs) {
      await go(t)
      const svg = await page.$$eval("svg", s => s.length)
      const anchors = await page.$$eval("header .kit-anchor", as => as.length)
      const panels = await page.$$eval("#kit-panels .kit-panel", ps => ps.length)
      const untitled = await page.$$eval(
        "header input, header select, header button, .kit-drawer input, .kit-drawer select, .kit-drawer button",
        els =>
          els
            .filter(e => !((e as HTMLElement).title || e.closest("label")?.title || e.closest<HTMLElement>(".kit-row")?.title))
            .map(e => `${e.tagName.toLowerCase()}#${e.id || (e as HTMLElement).dataset.key || e.textContent?.trim().slice(0, 12)}`),
      )
      rows.push(`/${t} svg=${svg} anchors=${anchors} panels=${panels} untitled=${untitled.join(",")}`)
      expect(svg, `/${t} svg`).toBeGreaterThan(0)
      expect(await tabX(), `/${t} tab x`).toEqual(x0)
      expect(await page.$("details.kit-drawer"), `/${t} drawer`).not.toBeNull()
      expect(untitled, `/${t} untitled`).toEqual([])
      expect(panels, `/${t} panels`).toBeGreaterThan(0)
    }
    console.log(rows.join("\n"))
    expect(pageErrors).toEqual([])
  })

  it("an edit replaces the url, shuffle pushes, back restores the pre-shuffle values", async () => {
    await go("slice")
    const key = await page.$eval("#kit-panels .kit-row input[type=range]", el => (el as HTMLElement).dataset.key ?? "")
    const sel = `#kit-panels .kit-row input[type=range][data-key="${key}"]`
    const max = await page.$eval(sel, el => (el as HTMLInputElement).max)
    const min = await page.$eval(sel, el => (el as HTMLInputElement).min)
    const target = String((Number(min) + Number(max)) / 2)
    await setRange(sel, target)
    await page.waitForTimeout(100)
    expect(page.url()).toContain(`slice.${key}=`)
    const before = { url: page.url(), value: await page.$eval(sel, el => (el as HTMLInputElement).value) }
    await page.click("#kit-panels button.kit-shuffle")
    await page.waitForTimeout(150)
    expect(page.url()).not.toBe(before.url)
    await page.goBack()
    await page.waitForTimeout(300)
    expect(page.url()).toBe(before.url)
    expect(await page.$eval(sel, el => (el as HTMLInputElement).value)).toBe(before.value)
  })

  it("a named state survives a reload and stays selected", async () => {
    await go("slice")
    const name = `e2e-${Date.now()}`
    await page.click("#kit-panels .kit-combo input")
    await page.keyboard.type(name)
    await page.keyboard.press("Enter")
    await page.waitForTimeout(100)
    expect(await page.$eval("#kit-panels .kit-sync", el => el.textContent)).toBe("●")
    await page.reload()
    await page.waitForSelector("#kit-panels .kit-combo input")
    await page.waitForTimeout(400)
    expect(await page.$eval("#kit-panels .kit-combo input", el => (el as HTMLInputElement).value)).toBe(name)
    await page.click("#kit-panels .kit-combo input")
    await page.click(`#kit-panels .kit-combo li.sel button[title=delete]`)
    await page.waitForTimeout(100)
    expect(await page.$eval("#kit-panels .kit-sync", el => el.textContent)).toBe("○")
  })
})
