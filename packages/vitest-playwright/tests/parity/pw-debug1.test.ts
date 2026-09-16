// pwp:pw-debug1: a debug environment must resolve workers=1, mirroring PW/common/index.js:579 where
// `configCLIOverrides.debug || configCLIOverrides.pause` pins workers to 1 before resolveWorkers.
// 0_options.ts has no debug rule, so the child resolves the host budget and this assert is red.
import { expect, test } from "vitest"
import { readReceipt, runChild } from "./helpers.js"

test("debug environment forces one worker", async () => {
  const r = await runChild("pw-debug1", { env: { VITEST_PLAYWRIGHT_DEBUG: "1" } })
  const workers = readReceipt<{ workers: number }>(r.dir, "workers.json")?.workers
  expect(
    workers,
    `pw-debug1: VITEST_PLAYWRIGHT_DEBUG=1 must resolve workers=1, the child resolved ${String(workers)}`,
  ).toBe(1)
})
