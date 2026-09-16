// pwp:pw-reuse: contextScope "worker" must hand every test in a worker the same context and reset it
// between them, mirroring PW/index.js:418-424 with CORE/coreBundle.js:52312-52322 resetForReuse.
// 0_options.ts knows only "test" and "file", so the child gets a fresh context per test and fails.
import { expect, test } from "vitest"
import { runChild } from "./helpers.js"

test("worker context scope shares one reset context per worker", async () => {
  const r = await runChild("pw-reuse")
  expect(
    r.code,
    `pw-reuse: contextScope "worker" must share one context per worker and reset its storage between tests; the child run failed\n${r.stdout}`,
  ).toBe(0)
})
