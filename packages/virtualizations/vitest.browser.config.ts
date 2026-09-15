import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// The DOM primitives (syncScroll, phantomScrollbar) need a real element model and
// real scroll geometry, so they run in chromium, not in a simulated DOM.
export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: "chromium", viewport: { width: 1200, height: 800 } }],
      headless: true,
      screenshotFailures: true,
    },
    include: ["src/phantomScrollbar.test.ts", "src/scrollSync.test.ts"],
    testTimeout: 60_000,
  },
});
