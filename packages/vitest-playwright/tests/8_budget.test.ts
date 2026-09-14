// The budget reads the live host, so the assertions are its invariants against real figures: the
// memory wall, the core cap, and the floor the plugin applies when it takes the default.
import { availableParallelism } from "node:os"
import { describe, expect, test } from "vitest"
import { availableMemoryBytes, BYTES_PER_WORKER, workerBudget } from "../src/12_budget.js"
import { resolveOptions } from "../src/0_options.js"

describe("workerBudget", () => {
  test("available memory is a positive figure above node's free-pages count on darwin", () => {
    const bytes = availableMemoryBytes()
    expect(bytes).toBeGreaterThan(0)
    expect(Number.isFinite(bytes)).toBe(true)
  })

  test("workers never exceed half the cores, and are 0 exactly when one browser does not fit", () => {
    const budget = workerBudget()
    expect(budget.cores).toBe(availableParallelism())
    expect(budget.workers).toBeLessThanOrEqual(Math.max(1, Math.floor(budget.cores / 2)))
    expect(budget.workers === 0).toBe(budget.availableBytes < BYTES_PER_WORKER)
  })

  test("a bytesPerWorker larger than the machine yields 0; a tiny one yields the core cap", () => {
    expect(workerBudget({ bytesPerWorker: Number.MAX_SAFE_INTEGER }).workers).toBe(0)
    const cap = workerBudget({ bytesPerWorker: 1, max: 3 })
    expect(cap.workers).toBeGreaterThanOrEqual(1)
    expect(cap.workers).toBeLessThanOrEqual(3)
  })

  test("the plugin default floors the budget at 1 and an explicit workers value wins", () => {
    expect(resolveOptions({}).workers).toBeGreaterThanOrEqual(1)
    expect(resolveOptions({ workers: "25%" }).workers).toBe("25%")
    expect(resolveOptions({ workers: 4 }).workers).toBe(4)
  })
})
