import { defineConfig } from "vitest/config"

// Node-side unit tests only; the browser suites run through vitest.browser.config.ts.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["src/**/*.browser.test.*", "node_modules/**", "dist/**"],
  },
})
