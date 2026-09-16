// pkg:semaphore test harness. Parent process only: no playwright plugin, so the parent test is a plain vitest
// test that spawns two real child `vitest run` processes on the fixture project. Single file, one worker at a
// time, generous timeouts for the two child browser runs.
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["tests/semaphore/*.test.ts"],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
})