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

  it('alt-click on a status cell pivots, and Back removes the pivot', async () => {
    await expandEverything(page)
    await page.locator('[data-testid=tree-row].test [data-testid=status-cell]').first().click({ modifiers: ['Alt'] })
    await page.waitForTimeout(200)
    expect(await page.locator('[data-testid=pivot-stack]').count()).toBe(1)
    await page.goBack()
    await page.waitForTimeout(200)
    expect(await page.locator('[data-testid=pivot-stack]').count()).toBe(0)
  })

  it('never threw a page error', () => {
    expect(pageErrors).toEqual([])
  })
})
