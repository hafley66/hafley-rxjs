import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:4180",
    trace: "on",
    screenshot: "on",
    viewport: { width: 800, height: 600 },
    deviceScaleFactor: 1,
    launchOptions: {
      args: [
        "--enable-unsafe-swiftshader",
        "--enable-webgpu-developer-features",
        "--use-angle=swiftshader",
      ],
    },
  },
  webServer: {
    command: "pnpm exec vite --host 127.0.0.1 --port 4180",
    port: 4180,
    reuseExistingServer: false,
  },
})
