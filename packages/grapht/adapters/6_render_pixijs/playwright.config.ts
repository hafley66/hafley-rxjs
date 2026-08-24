import { defineConfig } from "@playwright/test"

const port = Number(process.env.GRAPHT_PORT ?? 4180)

export default defineConfig({
  testDir: "e2e",
  testIgnore: process.env.GRAPHT_MASSIVE === "1" ? [] : "**/2_massive.spec.ts",
  timeout: 60_000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
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
    command: `pnpm exec vite --host 127.0.0.1 --port ${port}`,
    port,
    reuseExistingServer: true,
  },
})
