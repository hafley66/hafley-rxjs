// Nav tree behavior against out/report.html (built by `pnpm test`). Plain vitest `expect`, not
// @playwright/test's matchers: assertions read `.count()`/`.isVisible()`/`.getAttribute()` directly.
//
// Nav rows are @hafley66/grid's TreeTable markup: `[data-testid=tree-row]` plus the kind
// (process/file/test), `status-<status>`, and `selected` classes NavColumns.tsx's rowClassName
// applies.
import { type Browser, type Page } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { assertReportBuilt, expandEverything, launchReportPage, openPopover } from './e2eHelpers'

assertReportBuilt()

let browser: Browser
let page: Page
const pageErrors: string[] = []

beforeAll(async () => {
  ;({ browser, page } = await launchReportPage(pageErrors))
})
afterAll(async () => {
  await browser.close()
})

describe('vitest-telemetry nav tree', () => {
  it('auto-selects the first failing test with a red nav row', async () => {
    expect(await page.locator('[data-testid=tree-row].status-fail').count()).toBeGreaterThan(0)
    const selectedClass = await page.locator('[data-testid=tree-row].selected').first().getAttribute('class')
    expect(selectedClass).toContain('status-fail')
  })

  it('default view opens with the failing test selected and other branches collapsed', async () => {
    expect(await page.locator('[data-testid=default-view-hint]').count()).toBe(1)
    expect(await page.locator('[data-testid=tree-row].test').count()).toBe(1)
    expect(await page.locator('[data-testid=tree-row][data-expanded=false]').count()).toBeGreaterThan(0)
  })

  it('nav select then Back restores the previous selection', async () => {
    await expandEverything(page)
    const before = await page.locator('[data-testid=tree-row].test.selected .nav-name-primary').first().textContent()
    const other = page.locator('[data-testid=tree-row].test').filter({ hasNotText: before ?? '' }).first()
    await other.click()
    await page.waitForTimeout(300)
    const afterClick = await page.locator('[data-testid=tree-row].test.selected .nav-name-primary').first().textContent()
    expect(afterClick).not.toBe(before)
    await page.goBack()
    await page.waitForTimeout(300)
    const afterBack = await page.locator('[data-testid=tree-row].test.selected .nav-name-primary').first().textContent()
    expect(afterBack).toBe(before)
  })

  it('clicking the duration header reorders the visible rows', async () => {
    const before = await page.locator('[data-testid=tree-row] .nav-name-primary').allTextContents()
    const th = page.locator('[data-testid=tree-table-header] th', { hasText: 'duration' })
    await th.click()
    await page.waitForTimeout(150)
    const after = await page.locator('[data-testid=tree-row] .nav-name-primary').allTextContents()
    expect(after).not.toEqual(before)
    await th.click()
    await th.click()
  })

  it('compact chains toggle changes the visible row count', async () => {
    const before = await page.locator('[data-testid=tree-row]').count()
    await openPopover(page, '#prefs-gear', 'prefs-popover')
    const toggle = page.locator('#prefs-popover fieldset', { hasText: 'tree' }).locator('input')
    await toggle.click({ force: true })
    await page.waitForTimeout(200)
    const after = await page.locator('[data-testid=tree-row]').count()
    expect(after).toBeLessThan(before)
    await toggle.click({ force: true })
    await page.keyboard.press('Escape')
  })

  // TreeTable exposes no per-row hover/mouseenter hook (onRowClick carries no event, there is no
  // onRowHover), so the old JS-driven ancestor-chain outline is gone; this is plain CSS :hover.
  it('hovering a plain test row changes its background', async () => {
    const row = page.locator('[data-testid=tree-row].test:not(.selected):not(.status-fail)').first()
    const before = await row.evaluate((el) => getComputedStyle(el).backgroundColor)
    await row.hover()
    await page.waitForTimeout(150)
    const after = await row.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(after).not.toBe(before)
  })

  it('failed only reduces rows to the failing branch', async () => {
    const before = await page.locator('[data-testid=tree-row]').count()
    await page.locator('header label', { hasText: 'failed only' }).locator('input').check()
    await page.waitForTimeout(150)
    const after = await page.locator('[data-testid=tree-row]').count()
    expect(after).toBeLessThan(before)
    expect(await page.locator('[data-testid=tree-row].test').count()).toBe(1)
    await page.locator('header label', { hasText: 'failed only' }).locator('input').uncheck()
    await page.waitForTimeout(150)
  })

  it('the status legend popover opens from the header', async () => {
    await openPopover(page, '#status-legend-gear', 'status-legend-popover')
    expect(await page.locator('#status-legend-popover').isVisible()).toBe(true)
    await page.keyboard.press('Escape')
  })

  it('events, drawer, and pivot gutters each resize their panel and persist the px', async () => {
    const drag = async (testId: string, dx: number, dy: number) => {
      const el = page.locator(`[data-testid=${testId}]`)
      await el.scrollIntoViewIfNeeded()
      const box = (await el.boundingBox())!
      const x = box.x + box.width / 2
      const y = box.y + box.height / 2
      await page.mouse.move(x, y)
      await page.mouse.down()
      await page.mouse.move(x + dx, y + dy, { steps: 4 })
      await page.mouse.up()
      await page.waitForTimeout(100)
    }
    const track = (name: string) => page.evaluate((n) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(`--track-${n}`)), name)
    const shell = page.locator('[data-testid=marbler]')
    const before = (await shell.boundingBox())!.height
    await drag('events-gutter', 0, 120)
    expect(await track('events')).toBe(before + 120)
    expect((await shell.boundingBox())!.height).toBe(before + 120)

    await page.locator('[data-testid=marbler] .grid-body .grid-row').first().click()
    await page.waitForTimeout(100)
    const drawer = page.locator('[data-testid=event-details]')
    const drawerBefore = (await drawer.boundingBox())!.width
    await drag('drawer-gutter', -100, 0)
    expect(await track('drawer')).toBe(drawerBefore + 100)
    expect((await drawer.boundingBox())!.width).toBe(drawerBefore + 100)

    await expandEverything(page)
    await page.locator('[data-testid=tree-row].test [data-testid=status-cell]').first().click({ modifiers: ['Alt'] })
    await page.waitForTimeout(200)
    const pivotBefore = await track('pivot')
    await drag('pivot-gutter', 0, -60)
    expect(await track('pivot')).toBe(pivotBefore - 60)
    expect(JSON.parse(await page.evaluate(() => localStorage.getItem('vitest-telemetry.tracks') ?? '{}'))).toMatchObject({ events: before + 120, drawer: drawerBefore + 100, pivot: pivotBefore - 60 })
    await page.locator('[data-testid=pivot-close]').click()
  })

  it('every nav row id is unique, so TanStack keys and React keys never collide', async () => {
    await expandEverything(page)
    const ids = await page.locator('nav [data-testid=tree-row]').evaluateAll((rows) => rows.map((r) => (r as HTMLElement).dataset.rowId))
    expect(ids.length).toBeGreaterThan(0)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('the popover column picker hides and restores a nav column', async () => {
    const heads = page.locator('nav th[data-column]')
    expect(await heads.count()).toBe(4)
    await openPopover(page, '#status-legend-gear', 'status-legend-popover')
    const events = page.locator('[data-testid=tree-visibility-item-events] input')
    await events.click()
    await page.waitForTimeout(100)
    expect(await heads.count()).toBe(3)
    expect(await page.locator('nav [data-testid=tree-row]').first().locator('td').count()).toBe(3)
    await events.click()
    await page.waitForTimeout(100)
    expect(await heads.count()).toBe(4)
    await page.keyboard.press('Escape')
  })

  it('alt-click on a status cell pivots, and Back removes the pivot', async () => {
    await expandEverything(page)
    await page.locator('[data-testid=tree-row].test [data-testid=status-cell]').first().click({ modifiers: ['Alt'] })
    await page.waitForTimeout(200)
    expect(await page.locator('[data-testid=pivot-stack]').count()).toBe(1)
    await page.goBack()
    await page.waitForTimeout(200)
    expect(await page.locator('[data-testid=pivot-stack]').count()).toBe(0)
  })

  it('the pivot ×, the title ×, and a nav click each drop every pivot', async () => {
    await expandEverything(page)
    const status = page.locator('[data-testid=tree-row].test [data-testid=status-cell]')
    const stack = page.locator('[data-testid=pivot-stack]')
    await status.first().click({ modifiers: ['Alt'] })
    await status.nth(1).click({ modifiers: ['Alt'] })
    await page.waitForTimeout(200)
    expect(await page.locator('.breadcrumb button').count()).toBe(4)
    // every pivot panel is the grid's TreeTable: sortable header, resize handle, no status column after a status pivot
    const panels = page.locator('[data-testid=pivot-panel] [data-testid=tree-table]')
    expect(await panels.count()).toBe(2)
    expect(await panels.first().locator('th[data-column]').allTextContents()).toEqual(['name', 'ms'])
    expect(await panels.first().locator('[data-testid=resize-label]').count()).toBe(1)
    await panels.first().locator('th[data-column=durationMs]').click()
    await page.waitForTimeout(100)
    expect(await panels.first().locator('th[data-column=durationMs]').textContent()).toMatch(/[▲▼]/)
    await page.locator('[data-testid=pivot-close]').click()
    await page.waitForTimeout(200)
    expect(await stack.count()).toBe(0)

    await status.first().click({ modifiers: ['Alt'] })
    await page.waitForTimeout(200)
    expect(await stack.count()).toBe(1)
    await page.locator('.title-close').click()
    await page.waitForTimeout(200)
    expect(await stack.count()).toBe(0)
    expect(await page.locator('[data-testid=tree-row].selected').count()).toBe(0)

    await status.first().click({ modifiers: ['Alt'] })
    await page.waitForTimeout(200)
    expect(await stack.count()).toBe(1)
    await page.locator('[data-testid=tree-row].test .nav-name-primary').nth(1).click()
    await page.waitForTimeout(200)
    expect(await stack.count()).toBe(0)
    expect(await page.locator('[data-testid=tree-row].test.selected').count()).toBe(1)
  })

  it('never threw a page error', () => {
    expect(pageErrors).toEqual([])
  })
})
