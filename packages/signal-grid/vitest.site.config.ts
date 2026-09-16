// The docs site as the page under test. `pnpm site` regenerates the pages from docs/ and then runs
// `vitepress dev`, which is the only server that also transforms this repository's workspace source
// on demand — that is what lets a test mount the real modules into the docs DOM.
//
// The site config is `strictPort`, so one site per port: 5180 is signal-grid's (see site/.vitepress)
// and a site dev server left running elsewhere fails this suite fast rather than silently testing it.
//
// Note that `pnpm site` runs the package's own docs step, so a run can leave regenerated docs and
// stats in the tree; that is the same thing `pnpm site` does by hand.
import { vitestPlaywright } from "@hafley66/vitest-playwright/plugin"
import { telemetry } from "@hafley66/vitest-telemetry/plugin"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [
    telemetry({ root: "signal-grid", outDir: "out/telemetry" }),
    vitestPlaywright({
      serve: {
        kind: "command",
        command: "pnpm site",
        // The page under test, not the site root: vitepress dev re-optimizes dependencies a couple
        // of seconds in and reloads the client, and a document request inside that window 404s. A
        // readiness probe that only asks the root would let the first test walk into it.
        url: "http://localhost:5180/hafley-rxjs/signal-grid/rows-sort",
        readyTimeoutMs: 180_000,
      },
      contextScope: "file",
      // Every page carries the hub's tab strip (`/hafley-rxjs/strip.js`), which exists at the Pages
      // root and not in a single site served on its own, so that request 404s here. The tests allow
      // exactly that miss themselves; every other console error, and every JS exception, still fails.
      log: { failOnConsoleError: false },
      timeouts: { action: 10_000, navigation: 30_000 },
      context: { viewport: { width: 1280, height: 900 } },
      expect: { timeout: 5000 },
      artifacts: { outDir: "out/pw", trace: "retain-on-failure" },
    }),
  ],
  test: { include: ["tests/5_site.e2e.test.ts"], testTimeout: 120_000, hookTimeout: 180_000 },
})