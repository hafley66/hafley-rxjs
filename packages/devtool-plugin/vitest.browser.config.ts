import react from "@vitejs/plugin-react"
import { playwright } from "@vitest/browser-playwright"
import { defineConfig } from "vitest/config"
import { rxjsHmrPlugin } from "./src/1_runtime_vite_plugin/1_rxjs_hmr_plugin"

export default defineConfig({
  plugins: [
    [rxjsHmrPlugin({ debug: false })] as ReturnType<typeof react>,
    react(),
  ],
  optimizeDeps: {
    exclude: ["rxjs"],
  },
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [
        {
          browser: "chromium",
          viewport: { width: 1280, height: 800 },
        },
      ],
      headless: true,
      screenshotFailures: true,
    },
    include: ["src/**/*.browser.test.{ts,tsx}"],
  },
})
