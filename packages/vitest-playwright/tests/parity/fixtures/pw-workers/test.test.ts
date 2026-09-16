// pwp:pw-workers: the default resolved worker count is bounded by memory and half the cores, never
// exceeding what the host carries. Mirrors PW/common/index.js:579,670-679 (resolveWorkers).
import { availableParallelism } from "node:os"
import { inject } from "vitest"
import { expect, test } from "../../../../src/4_test.js"
import { KEY } from "../../../../src/0_options.js"
import { BYTES_PER_WORKER, availableMemoryBytes } from "../../../../src/12_budget.js"
import { writeReceipt } from "../../helpers.js"

const o = inject(KEY.options)
const cores = availableParallelism()
const byMemory = Math.max(1, Math.floor(availableMemoryBytes() / BYTES_PER_WORKER))
const byCores = Math.max(1, Math.floor(cores / 2))
writeReceipt("workers.json", {
  workers: o.workers,
  cores,
  byMemory,
  byCores,
  availableBytes: availableMemoryBytes(),
})

test("default workers is a positive number within the memory and core caps", () => {
  expect(typeof o.workers).toBe("number")
  expect(o.workers).toBeGreaterThanOrEqual(1)
  expect(o.workers).toBeLessThanOrEqual(byCores)
  expect(o.workers).toBeLessThanOrEqual(byMemory)
})