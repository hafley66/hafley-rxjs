import react from "@vitejs/plugin-react"
import { playwright } from "@vitest/browser-playwright"
import { defineConfig } from "vitest/config"
import { DOM_TESTS } from "./vitest.config.js"

// Chromium in browser mode rather than the served suite under `tests/`: every file listed in
// DOM_TESTS builds its own elements, dispatches its own events, and reads them back in the same
// tick. None of them needs a bundle over http, a real pointer, or a hit test, which is what
// vitest.e2e.config.ts exists to provide.
export default defineConfig({
  plugins: [react()],
  resolve: { dedupe: ["react", "react-dom"] },
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: "chromium", viewport: { width: 1280, height: 800 } }],
      headless: true,
      screenshotFailures: true,
    },
    include: [...DOM_TESTS, "src/**/*.browser.test.{ts,tsx}"],
  },
})
