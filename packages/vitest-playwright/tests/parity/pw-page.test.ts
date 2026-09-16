// pwp:pw-page: a page has no teardown of its own (PW/index.js:445), so only the context close closes
// it. Green: the page saved by the first test reports isClosed() once its context closed.
import { expect, test } from "vitest"
import { runChild } from "./helpers.js"

test("page is closed by the context close alone", async () => {
  const r = await runChild("pw-page")
  expect(r.code, r.stderr).toBe(0)
})