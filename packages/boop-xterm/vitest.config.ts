import { defineConfig } from "vitest/config"
import { resolve } from "node:path"

export default defineConfig({
  resolve: { alias: { "@hafley66/signals": resolve(import.meta.dirname, "../signals/src/index.ts") } },
  test: {
    maxWorkers: 1,
    fileParallelism: false,
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
})
