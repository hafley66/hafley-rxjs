// pwp:pw-launch0: the browser fixture carries no timeout, the equivalent of PW/index.js:238
// timeout:0. The launch and the context acquire happen in the aroundEach hook, so under
// testTimeout:1 the body still receives an open page.
import { expect, test } from "../../../../src/4_test.js"

test("browser launch survives a 1ms test timeout", ({ page }) => {
  expect(page.isClosed()).toBe(false)
})
