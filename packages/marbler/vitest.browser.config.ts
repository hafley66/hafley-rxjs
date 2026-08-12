import react from "@vitejs/plugin-react"
import { playwright } from "@vitest/browser-playwright"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react()],
  test: {
    browser: {
      enabled: true,
      provider: playwright({ launchOptions: { args: ["--enable-precise-memory-info"] } }),
      instances: [{ browser: "chromium", viewport: { width: 1440, height: 900 } }],
      headless: true,
    },
    include: ["src/**/*.browser.test.{ts,tsx}"],
  },
})
