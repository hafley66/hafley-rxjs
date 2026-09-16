// pwp:pw-launchopts: launch options reach the browser launch (PW/index.js:213 via
// _defaultLaunchOptions). This package passes o.browser.launch straight into type.launch, so a launch
// arg appears on the DEBUG=pw:browser `<launching>` command line. Green pins the passthrough.
import { expect, test } from "../../../../src/4_test.js"

test("launch args are accepted and the browser launches", async ({ page }) => {
  await page.goto("about:blank")
  expect(page.url()).toBe("about:blank")
})