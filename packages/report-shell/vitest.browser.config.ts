import react from "@vitejs/plugin-react"
import { playwright } from "@vitest/browser-playwright"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react()],
  // grid resolves its own react through pnpm isolation; one copy or hooks read null dispatchers
  resolve: { dedupe: ["react", "react-dom"] },
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
