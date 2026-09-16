// pwp:pw-browser (file a): uses the page fixture, forcing a worker browser launch. Mirrors
// PW/index.js:216-238 where one browser is created per worker.
import { expect, test } from "../../../../src/4_test.js"

test("file a uses a page", async ({ page }) => {
  await page.goto("about:blank")
  expect(page.url()).toBe("about:blank")
})