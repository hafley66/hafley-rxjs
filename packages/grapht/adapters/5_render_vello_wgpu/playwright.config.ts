import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  use: {
    baseURL: "http://127.0.0.1:4185",
    browserName: "chromium",
    channel: "chrome",
    viewport: { width: 800, height: 600 },
    deviceScaleFactor: 1,
    launchOptions: { args: ["--enable-unsafe-webgpu", "--enable-unsafe-swiftshader"] },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm exec vite --host 127.0.0.1 --port 4185",
    port: 4185,
    reuseExistingServer: false,
  },
})
