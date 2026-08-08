import { defineConfig, devices } from "@playwright/test"
import { resolve } from "node:path"

const port = 4241

export default defineConfig({
  testDir: ".",
  testMatch: ["0_perfLab.spec.ts", "1_rectangleLab.spec.ts"],
  reporter: [["html", { open: "never", outputFolder: "../playwright-report" }], ["list"]],
  use: { baseURL: `http://127.0.0.1:${port}`, trace: "retain-on-failure", ...devices["Desktop Chrome"] },
  webServer: {
    command: `vite --host 127.0.0.1 --port ${port} --strictPort`,
    cwd: resolve(import.meta.dirname, ".."),
    url: `http://127.0.0.1:${port}/e2e-perf-lab.html`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
