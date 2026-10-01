import { defineConfig } from "vitest/config"
import { vitestPlaywright } from "@hafley66/vitest-playwright/plugin"

export default defineConfig({
  plugins: [vitestPlaywright({
    serve: { kind: "command", command: "../../../../node_modules/.bin/vite --config proof/vite.config.ts --host 127.0.0.1 --port 5187 --strictPort", cwd: import.meta.dirname, url: "http://127.0.0.1:5187" },
    context: { viewport: { width: 1100, height: 800 } },
  })],
  test: { include: ["17_layout.e2e.test.ts", "18_tree.e2e.test.ts", "19_gpu.e2e.test.ts"], testTimeout: 30000 },
})
