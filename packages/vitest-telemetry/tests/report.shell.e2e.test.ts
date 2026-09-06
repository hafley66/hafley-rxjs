// Shell/layout behavior against out/report.html: theme, presets, marbler, truncation, resize
// gutters, nav rail. Split out of report.e2e.test.ts to keep both files under the line budget;
// see that file's header for the shared harness notes.
import { type Browser, type Page } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { assertReportBuilt, launchReportPage, openPopover } from './e2eHelpers'

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

describe('vitest-telemetry report shell', () => {
  it('theme toggle to light changes the body background', async () => {
    const before = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    await openPopover(page, '#prefs-gear', 'prefs-popover')
    await page.locator('#prefs-popover input[name=theme][value=light]').click({ force: true })
    await page.waitForTimeout(200)
    const after = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    expect(after).not.toBe(before)
    await page.locator('#prefs-popover input[name=theme][value=dark]').click({ force: true })
    await page.keyboard.press('Escape')
  })

  it('clicking a marbler row shows the frames drawer and the attrs sub-table', async () => {
    await page.locator('[data-testid=marbler] .grid-row[data-event-id]').first().click()
    await page.waitForTimeout(200)
    expect(await page.locator('[data-testid=event-attrs]').count()).toBe(1)
  })

  it('save preset, reload, apply it back', async () => {
    await openPopover(page, '#presets-gear', 'presets-popover')
    page.once('dialog', (dialog) => dialog.accept('e2e-preset'))
    await page.locator('.preset-save').click()
    await page.waitForTimeout(200)
    await page.reload()
    await page.waitForTimeout(800)
    await openPopover(page, '#presets-gear', 'presets-popover')
    await page.selectOption('#preset-select', 'e2e-preset')
    await page.waitForTimeout(200)
    expect(await page.locator('#preset-select option', { hasText: 'e2e-preset' }).count()).toBe(1)
  })

  it('a truncated cell popover shows the full text on click', async () => {
    const anchor = page.locator('.truncated-anchor').first()
    if ((await anchor.count()) === 0) return
    // Truncated only arms its popover when the label actually overflows (see its own
    // `overflows()` check); a label that currently fits its box has nothing to click open.
    const overflowing = await anchor.evaluate((el) => el.scrollWidth > el.clientWidth + 1)
    if (!overflowing) return
    await anchor.click()
    await page.waitForTimeout(150)
    expect(await page.locator('.truncated-text').first().isVisible()).toBe(true)
  })

  it('the nav gutter drag writes --track-nav once on release, not mid-drag', async () => {
    const before = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--track-nav'))
    const gutter = page.locator('[data-testid=nav-gutter]')
    const box = await gutter.boundingBox()
    if (!box) return
    await page.mouse.move(box.x + 2, box.y + 5)
    await page.mouse.down()
    await page.mouse.move(box.x + 40, box.y + 5)
    const duringDrag = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--track-nav'))
    expect(duringDrag).toBe(before)
    await page.mouse.up()
    await page.waitForTimeout(150)
    const after = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--track-nav'))
    expect(after).not.toBe(before)
  })

  it('the overview gutter changes --track-overview', async () => {
    const before = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--track-overview'))
    const gutter = page.locator('[data-testid=overview-gutter]')
    const box = await gutter.boundingBox()
    if (!box) return
    await page.mouse.move(box.x + box.width / 2, box.y + 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y + 40)
    await page.mouse.up()
    await page.waitForTimeout(150)
    const after = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--track-overview'))
    expect(after).not.toBe(before)
  })

  it('the nav rail toggle collapses --track-nav to 28px and restores it', async () => {
    const before = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--track-nav'))
    await page.locator('[data-testid=nav-rail-toggle]').click()
    await page.waitForTimeout(150)
    const collapsed = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--track-nav'))
    expect(collapsed.trim()).toBe('28px')
    await page.locator('[data-testid=nav-rail-toggle]').click()
    await page.waitForTimeout(150)
    const restored = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--track-nav'))
    expect(restored).toBe(before)
  })

  it('never threw a page error', () => {
    expect(pageErrors).toEqual([])
  })
})
