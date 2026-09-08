import { telemetry } from "@hafley66/vitest-telemetry/plugin"
import { defineConfig } from "vitest/config"
import { vitestPlaywright } from "./src/1_plugin.js"

export default defineConfig({
  plugins: [
    // tel: LogTape sinks + per-worker otel SDK with host metrics (process.cpu.utilization per pid) into out/telemetry
    telemetry({ root: "vitest-playwright", outDir: "out/telemetry" }),
    vitestPlaywright({ artifacts: { outDir: "out/pw", trace: "off" }, expect: { timeout: 2000 } }),
  ],
  test: { include: ["tests/*.test.ts"], testTimeout: 30_000, hookTimeout: 30_000 },
})
