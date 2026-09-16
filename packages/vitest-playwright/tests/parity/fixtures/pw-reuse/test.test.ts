// pwp:pw-reuse: contextScope:"worker" must share one context per worker, reset between tests
// (PW/index.js:418-424). The package only knows "test" and "file", so two tests get distinct contexts
// today and the identity assert is red.
import { expect, test } from "../../../../src/4_test.js"
import type { BrowserContext } from "playwright"

let shared: BrowserContext | undefined

test("first test records the context", async ({ context }) => {
  shared = context
  await context.addCookies([{ name: "k", value: "v", url: "http://x.test" }])
})

test("second test reuses the same context with storage reset", async ({ context }) => {
  expect(context, "pw-reuse: contextScope 'worker' must share one context per worker").toBe(shared)
  const cookies = await context.cookies("http://x.test")
  expect(cookies.length, "pw-reuse: the reused context must reset storage between tests").toBe(0)
})