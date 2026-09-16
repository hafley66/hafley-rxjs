// pwp:pw-timeouts: action timeout is set on the per-test context (PW/index.js:349-352 via
// setDefaultTimeout). timeouts.action:50 makes a click on a missing node fail well under 500ms.
import { expect, test } from "../../../../src/4_test.js"
import { writeReceipt } from "../../helpers.js"

test("action timeout of 50ms fails a missing-node click fast", async ({ page }) => {
  await page.goto("about:blank")
  const t0 = performance.now()
  let threw = false
  try {
    await page.locator("#nope").click()
  } catch {
    threw = true
  }
  const ms = performance.now() - t0
  writeReceipt("timeouts.json", { ms })
  expect(threw).toBe(true)
  expect(ms, `pw-timeouts: missing-node click took ${Math.round(ms)}ms, expected < 500`).toBeLessThan(500)
})