// pwp:pw-timeouts: action timeouts are set on the per-test context (PW/index.js:349-352), so a
// timeouts.action of 50 fails a missing-node click in under 500ms. Green pins the fast failure.
import { expect, test } from "vitest"
import { readReceipt, runChild } from "./helpers.js"

test("action timeout makes a missing-node click fail fast", async () => {
  const r = await runChild("pw-timeouts")
  expect(r.code, r.stderr).toBe(0)
  const ms = readReceipt<{ ms: number }>(r.dir, "timeouts.json")?.ms ?? Infinity
  expect(ms, `pw-timeouts: click took ${Math.round(ms)}ms, expected < 500`).toBeLessThan(500)
})