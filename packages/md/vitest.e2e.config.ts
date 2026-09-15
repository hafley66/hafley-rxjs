import { fileURLToPath } from "node:url"
import { telemetry } from "@hafley66/vitest-telemetry/plugin"
import { vitestPlaywright } from "@hafley66/vitest-playwright/plugin"
import { defineConfig } from "vitest/config"

// @hafley66/vitest-playwright: the serve slot builds fixtures/ and previews it over http
// (mermaid and the d2 wasm bundle need real URLs, so no file:// here). Tests drive the
// real page with locators; this package has no jsdom environment at all.
const fixtures = fileURLToPath(new URL("fixtures/", import.meta.url))

export default defineConfig({
  plugins: [
    telemetry({ root: "md", outDir: "out/telemetry" }),
    vitestPlaywright({
      serve: { kind: "vite", build: { configFile: `${fixtures}vite.config.ts`, root: fixtures }, serve: "preview" },
      contextScope: "file",
      // playwright's defaults are no timeout at all; a hung action should fail fast.
      timeouts: { action: 10_000, navigation: 30_000 },
      context: { viewport: { width: 1200, height: 800 } },
      expect: { timeout: 5000 },
      artifacts: { outDir: "out/pw", trace: "retain-on-failure" },
    }),
  ],
  test: { include: ["tests/*.e2e.test.ts"], testTimeout: 120_000, hookTimeout: 120_000 },
})
