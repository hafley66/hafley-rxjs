// The docs site as the page under test. `vitepress dev` is the only server that also transforms this
// repository's workspace source on demand — that is what lets a test mount the real modules into the
// docs DOM.
//
// The command is `vitepress dev site` and not `pnpm site`, unlike the other sites in this workspace:
// this site's `site/pages/**` is tracked by git, and `pnpm site` starts with `site:content`, which
// deletes that directory and regenerates it. A suite that did that would leave tracked pages
// modified by the mere act of running a test. The pages on disk are the pages this serves.
//
// The site config is `strictPort`, so one site per port: 5184 is this package's (see
// site/.vitepress/config.ts) and a site dev server left running elsewhere fails this suite fast
// rather than silently testing it.
import { vitestPlaywright } from "@hafley66/vitest-playwright/plugin"
import { telemetry } from "@hafley66/vitest-telemetry/plugin"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [
    telemetry({ root: "grapht", outDir: "out/telemetry" }),
    vitestPlaywright({
      serve: {
        kind: "command",
        command: "vitepress dev site",
        // The page under test, not the site root: vitepress dev re-optimizes dependencies a couple
        // of seconds in and reloads the client, and a document request inside that window 504s. A
        // readiness probe that only asks the root would let the first test walk into it.
        url: "http://localhost:5184/hafley-rxjs/grapht/model",
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
  test: { include: ["tests/17_site.e2e.test.ts"], testTimeout: 120_000, hookTimeout: 180_000 },
  test: { maxWorkers: 1, fileParallelism: false },
})