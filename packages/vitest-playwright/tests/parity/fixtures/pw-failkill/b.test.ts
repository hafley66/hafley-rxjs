// pwp:pw-failkill (file b): runs after file a failed in the same worker. If the worker were recycled
// after the failure (PW/runner/index.js:5293-5296), this browser launch is a fresh one, so the child
// run records a second `<launching>` debug line. The parent counts them and requires two.
import { expect, test } from "../../../../src/4_test.js"

test("file b uses a browser after the failure", async ({ page }) => {
  await page.goto("about:blank")
  expect(page.url()).toBe("about:blank")
})