// pwp:pw-failkill (file a): uses the browser then fails. Mirrors PW/runner/index.js:5293-5296 where a
// failed test stops the worker, so file b's browser is a fresh launch (a second `<launching>` line).
import { expect, test } from "../../../../src/4_test.js"

test("file a fails", async ({ page }) => {
  await page.goto("about:blank")
  expect.fail("pw-failkill: file a deliberately fails")
})