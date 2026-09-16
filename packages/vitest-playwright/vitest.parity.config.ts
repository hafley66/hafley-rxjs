import { defineConfig } from "vitest/config"

// Parent harness for the playwright/test parity suite. No playwright plugin here: this run is plain
// node. Every child vitest run a parity test spawns is a fixture under tests/parity/fixtures/<id> that
// mounts the real plugin; the parent only asserts on the child's exit code, stdout and receipt files.
// Machine safety: files serial, one worker, so at most one child run is alive at once.
export default defineConfig({
  test: {
    include: ["tests/parity/*.test.ts"],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
})