// pwp:pw-browser (file b): same worker as a.test.ts under isolate:false, so it must reuse the same
// browser: one launch total across the two files. Mirrors PW/index.js:216-238 (browser per worker).
import { expect, test } from "../../../../src/4_test.js"

test("file b uses a page", async ({ page }) => {
  await page.goto("about:blank")
  expect(page.url()).toBe("about:blank")
})