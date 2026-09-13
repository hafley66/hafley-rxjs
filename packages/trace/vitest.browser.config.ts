
import { playwright } from "@vitest/browser-playwright"
import { defineConfig } from "vitest/config"

export default defineConfig({
  
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: "chromium", viewport: { width: 1280, height: 800 } }],
      headless: true,
      screenshotFailures: true,
    },
    include: ["src/**/*.browser.test.{ts,tsx}"],
  },
})
