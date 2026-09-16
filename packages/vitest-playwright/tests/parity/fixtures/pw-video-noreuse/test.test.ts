// pwp:pw-video-noreuse: video disables context reuse (PW/index.js:364,423), so even under
// contextScope:"worker" a video-on run must give each test a fresh context. Today worker scope is not
// implemented, so contexts are per-test and this trivially passes; the assert only bites once worker
// scope shares contexts without video.
import { expect, test } from "../../../../src/4_test.js"
import type { BrowserContext } from "playwright"

let first: BrowserContext | undefined

test("first test records the context", async ({ context }) => {
  first = context
  await context.addCookies([{ name: "k", value: "v", url: "http://x.test" }])
})

test("video forces a new context per test", async ({ context }) => {
  expect(context).not.toBe(first)
})