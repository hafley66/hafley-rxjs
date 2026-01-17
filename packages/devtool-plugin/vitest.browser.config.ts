import react from "@vitejs/plugin-react"
import { playwright } from "@vitest/browser-playwright"
import { defineConfig } from "vitest/config"
import { rxjsHmrPlugin } from "./src/1_runtime_vite_plugin/1_rxjs_hmr_plugin"
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    [rxjsHmrPlugin({ debug: true })] as ReturnType<typeof react>,
    react(),tsconfigPaths()
  ],
  optimizeDeps: {
    exclude: ["rxjs", "rxjs/operators"],
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
