// pwp:pw-connect-env: when PW_TEST_CONNECT_WS_ENDPOINT is set, every worker connects instead of
// launching (PW/index.js:197-199,540). The child uses a page; the parent counts local launches and
// requires zero. The package does not read the env today, so the child launches locally and this is red.
import { expect, test } from "../../../../src/4_test.js"

test("a page still works under the connect env", async ({ page }) => {
  await page.goto("about:blank")
  expect(page.url()).toBe("about:blank")
})