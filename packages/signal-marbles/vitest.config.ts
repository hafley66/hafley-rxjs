import { defineConfig } from "vitest/config"

// Node-side unit tests only; the browser suite runs through vitest.browser.config.ts.
export default defineConfig({
  test: {
    maxWorkers: 1,
    fileParallelism: false,
    include: ["src/**/*.test.ts"],
    exclude: ["src/**/*.browser.test.*", "node_modules/**", "dist/**"],
  },
})
