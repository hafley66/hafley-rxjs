// pwp:pw-workers: the resolved worker count is bounded by memory and half the cores, mirroring
// PW/common/index.js:579,670-679 resolveWorkers where the default is floor(cpus/2). The child fixture
// asserts the resolved budget against the live host and writes the figures it used.
import { expect, test } from "vitest"
import { readReceipt, runChild } from "./helpers.js"

interface WorkersReceipt {
  workers: number
  cores: number
  byMemory: number
  byCores: number
}

test("default workers respects the memory and half-core caps", async () => {
  const r = await runChild("pw-workers")
  expect(r.code, r.stdout).toBe(0)
  const w = readReceipt<WorkersReceipt>(r.dir, "workers.json")
  expect(w?.workers).toBeGreaterThanOrEqual(1)
  expect(w?.workers, `pw-workers: ${JSON.stringify(w)}`).toBeLessThanOrEqual(w?.byCores ?? 0)
  expect(w?.workers, `pw-workers: ${JSON.stringify(w)}`).toBeLessThanOrEqual(w?.byMemory ?? 0)
})
