import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./tests",
  testMatch: "2_browser.smoke.ts",
  use: { baseURL: "http://127.0.0.1:4176" },
  webServer: {
    command: "pnpm exec vite --host 127.0.0.1 --port 4176 --strictPort",
    port: 4176,
    reuseExistingServer: false,
  },
})
