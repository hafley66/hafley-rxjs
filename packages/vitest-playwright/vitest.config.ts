import { defineConfig } from "vitest/config"
import { vitestPlaywright } from "./src/1_plugin.js"

export default defineConfig({
  plugins: [vitestPlaywright({ artifacts: { outDir: "out/pw", trace: "off" }, expect: { timeout: 2000 } })],
  test: { include: ["tests/*.test.ts"], testTimeout: 30_000, hookTimeout: 30_000 },
})
