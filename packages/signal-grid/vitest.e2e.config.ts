import { fileURLToPath } from "node:url"
import { vitestPlaywright } from "@hafley66/vitest-playwright/plugin"
import { telemetry } from "@hafley66/vitest-telemetry/plugin"
import { defineConfig } from "vitest/config"

// @hafley66/vitest-playwright: the serve slot builds fixtures/dist and previews it over http. A
// file:// baseURL would need the bundle inlined, because chromium refuses a cross-origin module
// script from a file, and this package carries no single-file plugin.
const fixtures = fileURLToPath(new URL("fixtures/", import.meta.url))

export default defineConfig({
  plugins: [
    telemetry({ root: "signal-grid", outDir: "out/telemetry" }),
    vitestPlaywright({
      serve: {
        kind: "vite",
        build: { configFile: `${fixtures}vite.config.ts`, root: fixtures },
        serve: "preview",
      },
      contextScope: "file",
      context: { viewport: { width: 1200, height: 800 } },
      expect: { timeout: 5000 },
      artifacts: { outDir: "out/pw", trace: "retain-on-failure" },
    }),
  ],
  test: { include: ["tests/*.e2e.test.ts"], exclude: ["tests/2_visual.e2e.test.ts"], testTimeout: 60_000, hookTimeout: 60_000 },
})
