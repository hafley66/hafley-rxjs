// Raw playwright against out/boop-network.html (built by the boop-network CLI), chromium headless.
// Plain vitest `expect`, not @playwright/test's matchers.
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { chromium, type Browser, type Page } from "playwright"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const REPORT_PATH = resolve(import.meta.dirname, "../out/boop-network.html")
const REPORT_URL = `file://${REPORT_PATH}`

if (!existsSync(REPORT_PATH)) {
  throw new Error(`missing ${REPORT_PATH}: run \`node dist/9_cli.js report\` in packages/boop-adapters first`)
}

let browser: Browser
let page: Page
const pageErrors: string[] = []

beforeAll(async () => {
  browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, colorScheme: "dark" })
  page = await context.newPage()
  page.on("pageerror", (error) => pageErrors.push(error.message))
  await page.goto(REPORT_URL)
  await page.waitForSelector("[data-testid=tree-row]", { timeout: 15_000 })
  await page.waitForTimeout(300)
})
afterAll(async () => {
  await browser.close()
})

function treeRows() {
  return page.locator("[data-testid=tree-row]")
}
function foldRows() {
  return page.locator("[data-testid=tree-row].fold")
}
function firstRowName() {
  return treeRows().first().locator(".name-primary, .name-fold").first().textContent()
}

describe("boop network report", () => {
  it("renders at least one session row", async () => {
    expect(await treeRows().count()).toBeGreaterThan(0)
  })

  it("shows a narrower set than all sessions by default (active window)", async () => {
    expect(await page.locator("[data-testid=window-select]").inputValue()).toBe("active")
    const countsText = await page.locator("[data-testid=counts]").textContent()
    const totalMatch = countsText?.match(/N (\d+) sessions/)
    expect(totalMatch).not.toBeNull()
    const total = Number(totalMatch![1])
    expect(await foldRows().count()).toBeLessThanOrEqual(1)
    expect(await treeRows().count()).toBeLessThan(total)
  })

  it("folds sessions outside the window under one row that expands on click", async () => {
    const foldCount = await foldRows().count()
    if (foldCount === 0) return
    const foldRow = foldRows().first()
    const before = await treeRows().count()
    await foldRow.locator(".name-fold").click()
    await page.waitForTimeout(200)
    const after = await treeRows().count()
    expect(after).toBeGreaterThan(before)
    await foldRow.locator(".name-fold").click()
    await page.waitForTimeout(200)
    expect(await treeRows().count()).toBe(before)
  })

  it("shows a status word with a colored dot on every session row", async () => {
    const cells = page.locator("[data-testid=tree-row]:not(.fold) .status-cell")
    const count = await cells.count()
    expect(count).toBeGreaterThan(0)
    const dotClass = await cells.first().locator(".dot").getAttribute("class")
    expect(dotClass).toMatch(/dot (running|waiting|idle|done|failed|unknown)/)
  })

  it("clicking the session column header sorts (the first row changes)", async () => {
    const before = await firstRowName()
    await page.locator("[data-testid=tree-table-header] th", { hasText: "session" }).click()
    await page.waitForTimeout(200)
    const after = await firstRowName()
    expect(after).not.toBe(before)
  })

  it("the window select changes how many rows are visible", async () => {
    const select = page.locator('[data-testid="window-select"]')
    await select.selectOption("live")
    await page.waitForTimeout(200)
    const liveCount = await treeRows().count()
    await select.selectOption("all")
    await page.waitForTimeout(200)
    const allCount = await treeRows().count()
    expect(allCount).toBeGreaterThanOrEqual(liveCount)
    await select.selectOption("active")
    await page.waitForTimeout(200)
  })

  it("opens the status legend popover", async () => {
    await page.locator("#status-legend-gear").click()
    await page.waitForTimeout(100)
    const open = await page.evaluate(() => document.querySelector("#status-legend-popover")?.matches(":popover-open") ?? false)
    expect(open).toBe(true)
    expect(await page.locator(".status-legend-row").count()).toBeGreaterThan(0)
    // Escape (native popover dismissal): a select's selectOption() never fires the outside
    // pointerdown that light-dismiss relies on, so later tests would find this panel still open.
    await page.keyboard.press("Escape")
    await page.waitForTimeout(100)
    const closed = await page.evaluate(() => document.querySelector("#status-legend-popover")?.matches(":popover-open") ?? false)
    expect(closed).toBe(false)
  })

  async function firstSelectableIndex(from = 0): Promise<number> {
    const rows = treeRows()
    const count = await rows.count()
    for (let i = from; i < count; i += 1) {
      if (await rows.nth(i).locator(".name-fold").count()) continue
      return i
    }
    return -1
  }

  it("Back restores the previous nav selection", async () => {
    // Runs under "all" so there are always at least two selectable (non-fold) rows to work with.
    await page.locator('[data-testid="window-select"]').selectOption("all")
    await page.waitForTimeout(200)
    const rows = treeRows()

    const firstIndex = await firstSelectableIndex()
    expect(firstIndex).toBeGreaterThanOrEqual(0)
    await rows.nth(firstIndex).locator(".status-cell").click()
    await page.waitForTimeout(200)
    expect(await rows.nth(firstIndex).getAttribute("class")).toContain("selected")

    const secondIndex = await firstSelectableIndex(firstIndex + 1)
    expect(secondIndex).toBeGreaterThanOrEqual(0)
    await rows.nth(secondIndex).locator(".status-cell").click()
    await page.waitForTimeout(300)
    expect(await rows.nth(secondIndex).getAttribute("class")).toContain("selected")
    expect(await rows.nth(firstIndex).getAttribute("class")).not.toContain("selected")

    await page.goBack()
    await page.waitForTimeout(300)
    expect(await rows.nth(firstIndex).getAttribute("class")).toContain("selected")

    await page.locator('[data-testid="window-select"]').selectOption("active")
    await page.waitForTimeout(200)
  })

  it("renders one frame kind chip per distinct kind in the data", async () => {
    const chips = await page.locator(".kind-chip").evaluateAll((els) => els.map((el) => el.getAttribute("data-kind")))
    expect(chips.length).toBeGreaterThan(0)
    expect(new Set(chips).size).toBe(chips.length)
  })

  it("the text filter narrows the visible rows", async () => {
    const before = await treeRows().count()
    await page.locator("header input[type=text]").fill("zzzz-no-such-session-zzzz")
    await page.waitForTimeout(200)
    const after = await treeRows().count()
    expect(after).toBeLessThan(before)
    await page.locator("header input[type=text]").fill("")
  })

  it("never threw a page error", () => {
    expect(pageErrors).toEqual([])
  })
})
