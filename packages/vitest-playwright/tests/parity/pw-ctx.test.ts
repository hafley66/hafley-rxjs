// pwp:pw-ctx: one context per test, closed when the test ends (PW/index.js:384,413). The child records
// the first test's context and asserts, from the second test, that it emitted "close" and is gone from
// browser.contexts(). Green pins the per-test create and close.
import { expect, test } from "vitest"
import { runChild } from "./helpers.js"

test("the context of a test is closed when that test ends", async () => {
  const r = await runChild("pw-ctx")
  expect(r.code, r.stdout).toBe(0)
})
