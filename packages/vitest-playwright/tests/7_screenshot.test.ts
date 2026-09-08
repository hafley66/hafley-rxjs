// toHaveScreenshot + the toMatchSnapshot alias. Baselines are seeded by the test itself under
// tests/__screenshots__/7_screenshot.test.ts/ and removed in afterAll, so the receipts do not depend on `-u`.
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { afterAll, describe, expect as vitestExpect, inject, it } from "vitest"
import { KEY } from "../src/0_options.js"
import { baselinePath } from "../src/11_screenshot.js"
import { attemptDir, slug } from "../src/8_around.js"
import { expect, test } from "../src/index.js"

const STATIC = "http://static.test/"
const html = (color: string) =>
  `<!doctype html><html><body style="margin:0;background:${color}"><div id="box" style="width:120px;height:80px;background:#345">box</div></body></html>`
const options = () => inject(KEY.options)
const shotsDir = join(import.meta.dirname, "__screenshots__")
const here = join(import.meta.dirname, "7_screenshot.test.ts")

async function serve(page: import("playwright").Page, color: string) {
  await page.route(STATIC, r => r.fulfill({ contentType: "text/html", body: html(color) }))
  await page.goto(STATIC)
}
async function seed(page: import("playwright").Page, name: string, color = "#fff") {
  await serve(page, color)
  const path = baselinePath(here, options(), name)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, await page.screenshot({ animations: "disabled", caret: "hide", scale: "css" }))
  return path
}
afterAll(() => rmSync(shotsDir, { recursive: true, force: true }))

describe("toHaveScreenshot", () => {
  test("matches a seeded baseline, page and locator", async ({ page }) => {
    await seed(page, "page.png")
    await expect(page).toHaveScreenshot("page.png")
    await expect(page).toHaveScreenshot("page")
    const box = baselinePath(here, options(), ["nested", "box.png"])
    mkdirSync(dirname(box), { recursive: true })
    writeFileSync(box, await page.locator("#box").screenshot({ animations: "disabled", caret: "hide", scale: "css" }))
    await expect(page.locator("#box")).toHaveScreenshot(["nested", "box.png"])
  })
  test("writes a missing baseline under update mode new, named after the full test name", async ({ page }) => {
    await serve(page, "#fff")
    const name = `${slug(vitestExpect.getState().currentTestName ?? "")}-1`
    const path = baselinePath(here, options(), name)
    vitestExpect(path).toMatch(
      new RegExp(`/7_screenshot\\.test\\.ts/tohavescreenshot-writes-a-missing-baseline.*-1-${options().browser.name}-${process.platform}\\.png$`),
    )
    vitestExpect(existsSync(path)).toBe(false)
    await expect(page).toHaveScreenshot({ timeout: 3000 })
    vitestExpect(existsSync(path)).toBe(true)
  })
  test("a mismatch fails with expected/actual/diff written to the attempt dir", async ({ page, task }) => {
    await seed(page, "mismatch.png", "#fff")
    await serve(page, "#f00")
    await vitestExpect(expect(page).toHaveScreenshot("mismatch.png", { timeout: 1500 })).rejects.toThrow(
      /toHaveScreenshot\("mismatch.png"\) failed/,
    )
    const dir = attemptDir(options(), task)
    vitestExpect(readdirSync(dir).sort()).toEqual(["mismatch-png-actual.png", "mismatch-png-diff.png", "mismatch-png-expected.png"])
  })
  test("the failure message names the paths and the pixel count", async ({ page }) => {
    await seed(page, "message.png", "#fff")
    await serve(page, "#0f0")
    const err = await expect(page).toHaveScreenshot("message.png", { timeout: 1000 }).catch(e => e as Error)
    vitestExpect(err).toBeInstanceOf(Error)
    vitestExpect((err as Error).message).toMatch(/pixels/i)
    vitestExpect((err as Error).message).toMatch(/message-png-diff\.png/)
  })
  test(".not passes on a different page and fails on the same one", async ({ page }) => {
    await seed(page, "not.png", "#fff")
    await serve(page, "#00f")
    await expect(page).not.toHaveScreenshot("not.png", { timeout: 1500 })
    await serve(page, "#fff")
    await vitestExpect(expect(page).not.toHaveScreenshot("not.png", { timeout: 1000 })).rejects.toThrow(/still matches/)
  })
  test(".not with no baseline fails and writes nothing", async ({ page }) => {
    await serve(page, "#fff")
    await vitestExpect(expect(page).not.toHaveScreenshot("never.png")).rejects.toThrow(/no baseline/)
    vitestExpect(existsSync(baselinePath(here, options(), "never.png"))).toBe(false)
  })
  test("maxDiffPixelRatio tolerates a small change", async ({ page }) => {
    await seed(page, "tolerant.png", "#fff")
    await serve(page, "#fff")
    await page.evaluate(() => {
      const d = document.createElement("div")
      d.style.cssText = "position:fixed;left:0;top:200px;width:4px;height:4px;background:#000"
      document.body.append(d)
    })
    await expect(page).toHaveScreenshot("tolerant.png", { maxDiffPixelRatio: 0.01 })
    await vitestExpect(expect(page).toHaveScreenshot("tolerant.png", { maxDiffPixels: 0, timeout: 1000 })).rejects.toThrow()
  })
  test("rejects a non page/locator receiver and expect.poll", async ({ page }) => {
    await serve(page, "#fff")
    vitestExpect(() => (expect("x") as unknown as { toHaveScreenshot: () => unknown }).toHaveScreenshot()).toThrow(
      /expected a playwright Page or Locator, received string/,
    )
    await vitestExpect(async () => {
      await (expect.poll(() => page) as unknown as { toHaveScreenshot: () => Promise<void> }).toHaveScreenshot()
    }).rejects.toThrow(/expect.poll\(\) does not support "toHaveScreenshot"/)
  })
})

describe("toMatchSnapshot alias", () => {
  test("$page.toMatchSnapshot routes to toHaveScreenshot", async () => {
    await seed($page, "alias.png")
    await expect($page).toMatchSnapshot("alias.png")
    await serve($page, "#f0f")
    // vitest types toMatchSnapshot(hint) only; per-call options need toHaveScreenshot
    await vitestExpect(expect($page).toMatchSnapshot("alias.png")).rejects.toThrow(
      /toHaveScreenshot\("alias.png"\) failed/,
    )
  })
  test("a locator receiver routes too, unnamed", async ({ page }) => {
    await serve(page, "#fff")
    const path = baselinePath(here, options(), `${slug(vitestExpect.getState().currentTestName ?? "")}-1`)
    await expect(page.locator("#box")).toMatchSnapshot()
    vitestExpect(existsSync(path)).toBe(true)
  })
  it("every other receiver keeps vitest's snapshot matcher", () => {
    vitestExpect({ a: 1 }).toMatchSnapshot()
    vitestExpect("plain").toMatchSnapshot()
  })
})
