import { defineConfig } from "vitest/config"
import { vitestPlaywright } from "@hafley66/vitest-playwright/plugin"
import { telemetry } from "@hafley66/vitest-telemetry/plugin"

// @hafley66/vitest-playwright: the serve slot builds dist/index.html (vite --mode single) and hands its file://
// URL to every worker as baseURL; one context + page per file (gothic pages are cheap to keep, tests navigate by hash).
export default defineConfig({
  plugins: [
    telemetry({ root: "vitest-playwright", outDir: "out/telemetry" }),
    vitestPlaywright({
      serve: { kind: "vite", build: { configFile: "vite.config.ts", root: import.meta.dirname }, mode: "single", serve: "file", reuseExisting: true },
      contextScope: "file",
      context: { viewport: { width: 1200, height: 800 } },
      expect: { timeout: 5000 },
      artifacts: { outDir: "out/pw", trace: "retain-on-failure" },
    }),
  ],
  test: { include: ["tests/*.e2e.test.ts"], testTimeout: 60_000, hookTimeout: 60_000 },
})
