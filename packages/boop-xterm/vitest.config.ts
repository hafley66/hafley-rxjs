import { defineConfig } from "vitest/config"
import { resolve } from "node:path"

export default defineConfig({
  resolve: { alias: {
    "@hafley66/trace": resolve(import.meta.dirname, "../trace/src/index.ts"),
  } },
  test: {
    maxWorkers: 1,
    fileParallelism: false,
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.browser.test.ts"],
  },
})
