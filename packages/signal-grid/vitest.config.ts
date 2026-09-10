import { defineConfig } from "vitest/config"

// `tests/` holds browser e2e that needs the serve slot and a real chromium, which only
// vitest.e2e.config.ts provides. Without this exclude, a bare `vitest run` collects those files
// with no baseURL and they skip themselves, which reads as a broken suite rather than a scoped one.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["tests/**", "fixtures/**", "node_modules/**", "dist/**"],
  },
})
