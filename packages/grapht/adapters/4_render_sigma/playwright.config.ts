import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "e2e",
  timeout: 45_000,
  use: {
    baseURL: "http://127.0.0.1:4179",
    trace: "on",
    screenshot: "on",
  },
  webServer: {
    command: "pnpm exec vite --host 127.0.0.1 --port 4179",
    port: 4179,
    reuseExistingServer: false,
  },
})
