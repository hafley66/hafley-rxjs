// App-level receipt over the built single file, on @hafley66/vitest-playwright: the plugin builds dist/index.html
// (serve slot, vite --mode single) and serves its file:// URL as baseURL; contextScope 'file' keeps one page for
// the file; page errors and console errors fail the owning test at teardown (no hand-rolled pageErrors list).
import { describe, expect, inject } from "vitest"
import { test } from "@hafley66/vitest-playwright/test"

const base = inject("vitest-playwright:baseURL")
const go = async (tab: string) => {
  await $page.goto(`${base}#/${tab}`)
  await expect($page.locator("header a[data-tab]").first()).toBeVisible()
  await $page.waitForTimeout(600)
}
const tabX = () => $page.$$eval("header a[data-tab]", as => as.map(a => Math.round(a.getBoundingClientRect().x)))
// React reads inputs through its value tracker, so writes go through the prototype setter before the event
const setRange = (sel: string, v: string) =>
  $page.$eval(sel, (el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(el, v)
    el.dispatchEvent(new Event("input", { bubbles: true }))
  }, v)

describe("gothic single file", () => {
  test("every tab renders svg, keeps the tab row fixed, mounts a drawer per section, and titles every control", async () => {
    await go("eye")
    const tabs = await $page.$$eval("header a[data-tab]", as => as.map(a => (a as HTMLElement).dataset.tab ?? ""))
    expect(tabs.length).toBeGreaterThan(5)
    const x0 = await tabX()
    const rows: string[] = []
    for (const t of tabs) {
      await go(t)
      await expect($page.locator("svg").first()).toBeVisible()
      await expect($page.locator(".kit-section > details.kit-drawer").first()).toBeAttached()
      const svg = await $page.locator("svg").count()
      const anchors = await $page.locator("header .kit-anchor").count()
      const panels = await $page.locator(".kit-section > .kit-drawer .kit-panel").count()
      const untitled = await $page.$$eval(
        "header input, header select, header button, .kit-drawer input, .kit-drawer select, .kit-drawer button",
        els => els
          .filter(e => !((e as HTMLElement).title || e.closest("label")?.title || e.closest<HTMLElement>(".kit-row")?.title))
          .map(e => `${e.tagName.toLowerCase()}#${e.id || (e as HTMLElement).dataset.key || e.textContent?.trim().slice(0, 12)}`),
      )
      rows.push(`/${t} svg=${svg} anchors=${anchors} panels=${panels} untitled=${untitled.join(",")}`)
      expect(await tabX(), `/${t} tab x`).toEqual(x0)
      expect(untitled, `/${t} untitled`).toEqual([])
      expect(panels, `/${t} panels`).toBeGreaterThan(0)
    }
    console.log(rows.join("\n"))
  })

  test("an edit replaces the url, shuffle pushes, back restores the pre-shuffle values", async () => {
    await go("slice")
    const key = await $page.$eval(".kit-drawer .kit-row input[type=range]", el => (el as HTMLElement).dataset.key ?? "")
    const sel = `.kit-drawer .kit-row input[type=range][data-key="${key}"]`
    const max = await $page.$eval(sel, el => (el as HTMLInputElement).max)
    const min = await $page.$eval(sel, el => (el as HTMLInputElement).min)
    const target = String((Number(min) + Number(max)) / 2)
    await setRange(sel, target)
    await expect($page).toHaveURL(new RegExp(`slice\\.${key}=`))
    const before = { url: $page.url(), value: await $page.$eval(sel, el => (el as HTMLInputElement).value) }
    await $page.click(".kit-drawer button.kit-shuffle")
    await expect($page).not.toHaveURL(before.url)
    await $page.goBack()
    await expect($page).toHaveURL(before.url)
    await expect($page.locator(sel)).toHaveValue(before.value)
  })

  test("no view transition on a knob commit: the page stays clickable and a double-click on shuffle shuffles twice", async () => {
    await go("slice")
    const shuffle = ".kit-drawer button.kit-shuffle"
    const seedInput = $page.locator(".kit-drawer .kit-row[data-kind=seed] input[type=number]")
    const hit = () =>
      $page.$eval(shuffle, b => {
        const r = b.getBoundingClientRect()
        return document.elementFromPoint(r.x + 4, r.y + 4)?.tagName
      })
    await $page.click(shuffle)
    expect(await hit(), "hit test right after a shuffle").toBe("BUTTON")
    const s1 = await seedInput.inputValue()
    const len = await $page.evaluate(() => history.length)
    await $page.dblclick(shuffle)
    await expect(seedInput).not.toHaveValue(s1)
    await expect(() => $page.evaluate(() => history.length).then(n => { if (n !== len + 2) throw new Error(`history ${n}`) })).toPass({ timeout: 2000 })
  })

  test("a named state survives a reload and stays selected", async () => {
    await go("slice")
    const name = `e2e-${Date.now()}`
    await $page.click(".kit-drawer .kit-combo input")
    await $page.keyboard.type(name)
    await $page.keyboard.press("Enter")
    await expect($page.locator(".kit-drawer .kit-sync")).toHaveText("●")
    await $page.reload()
    await expect($page.locator(".kit-drawer .kit-combo input")).toHaveValue(name)
    await $page.click(".kit-drawer .kit-combo input")
    await $page.click(`.kit-drawer .kit-combo li.sel button[title=delete]`)
    await expect($page.locator(".kit-drawer .kit-sync")).toHaveText("○")
  })
})
