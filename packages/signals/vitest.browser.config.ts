import { playwright } from "@vitest/browser-playwright"
import { defineConfig } from "vitest/config"
import { BROWSER_TESTS } from "./vitest.config.js"

// Real chromium for the document-bound suites. jsdom simulated the document for these three files
// until they moved here; a simulated document is what this package no longer keeps.
export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: "chromium", viewport: { width: 1280, height: 800 } }],
      headless: true,
      screenshotFailures: true,
    },
    include: [...BROWSER_TESTS],
  },
})
