import react from "@vitejs/plugin-react"
import { playwright } from "@vitest/browser-playwright"
import { defineConfig } from "vitest/config"

// Chromium in browser mode, exactly as signal-grid runs its own DOM surface. The file beside the
// React entry drags a card with real pointer events and reads the layout back, and a simulated
// document answers a hit test and a bounding box with zeroes. The node runner never collects it:
// `src/**/*.browser.test.tsx` is named nothing like `tests/`, which is the whole of that suite's
// filter, and this config's include is the only place the file appears.
export default defineConfig({
  plugins: [react()],
  resolve: { dedupe: ["react", "react-dom"] },
  test: {
    maxWorkers: 1,
    fileParallelism: false,
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
