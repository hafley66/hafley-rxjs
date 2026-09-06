// Shared bootstrap for the two report e2e files: opening out/report.html in headless chromium,
// and the popover / expand-everything gestures both files reuse.
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium, type Browser, type Page } from 'playwright'

export const REPORT_PATH = resolve(import.meta.dirname, '../out/report.html')
export const REPORT_URL = `file://${REPORT_PATH}`

export function assertReportBuilt(): void {
  if (!existsSync(REPORT_PATH)) {
    throw new Error(`missing ${REPORT_PATH}: run \`pnpm test\` in packages/vitest-telemetry first`)
  }
}

// No dev server: the report is one self-contained file, opened via file://.
export async function launchReportPage(pageErrors: string[]): Promise<{ browser: Browser; page: Page }> {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1400, height: 800 }, colorScheme: 'dark' })
  const page = await context.newPage()
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto(REPORT_URL)
  await page.waitForSelector('[data-testid=tree-row]', { timeout: 10_000 })
  await page.waitForTimeout(300)
  return { browser, page }
}

// Popovers toggle on gear click: if a prior test left one open, opening a different one first
// needs it closed, so every popover-driven step starts from a known (closed) state.
export async function openPopover(page: Page, gearId: string, popoverId: string): Promise<void> {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(50)
  await page.locator(gearId).click()
  await page.waitForFunction((id) => document.getElementById(id)?.matches(':popover-open'), popoverId)
}

// Default view starts with only the failing test's branch expanded; several tests need every
// row visible (a second test to click, more siblings to sort). Bounded: the tree is small.
export async function expandEverything(page: Page): Promise<void> {
  for (let i = 0; i < 40; i++) {
    const toggle = page.locator('[data-testid=tree-row][data-expanded=false] button').first()
    if ((await toggle.count()) === 0) break
    await toggle.click()
    await page.waitForTimeout(30)
  }
}
