import { fileURLToPath } from "node:url"
import { vitestPlaywright } from "@hafley66/vitest-playwright/plugin"
import { telemetry } from "@hafley66/vitest-telemetry/plugin"
import { defineConfig } from "vitest/config"

// Same serve slot as vitest.e2e.config.ts: fixtures/ is built once and previewed over http, because
// chromium refuses a cross-origin module script from a file:// page.
const fixtures = fileURLToPath(new URL("fixtures/", import.meta.url))

export default defineConfig({
  plugins: [
    // Its own outDir so a concurrent `test:e2e` run cannot interleave records into the same files.
    telemetry({ root: "signal-grid", outDir: "out/telemetry-visual" }),
    vitestPlaywright({
      serve: {
        kind: "vite",
        build: { configFile: `${fixtures}vite.config.ts`, root: fixtures },
        serve: "preview",
      },
      // Not "file". 8_around.ts wires recordVideo only on the branch that builds its own context,
      // so a file-scoped page would film every test into one clip, or none.
      contextScope: "test",
      context: { viewport: { width: 1400, height: 900 } },
      expect: { timeout: 10_000 },
      artifacts: { video: "on", outDir: "out/visual", trace: "on" },
    }),
  ],
  test: {
    include: ["tests/2_visual.e2e.test.ts"],
    testTimeout: 240_000,
    hookTimeout: 240_000,
  },
})
