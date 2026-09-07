import { resolve } from "path"
import { defineConfig } from "vitest/config"

const entries = ["eye", "slice", "icons", "border", "fractal"]

export default defineConfig({
  build: {
    rollupOptions: { input: Object.fromEntries(entries.map(e => [e, resolve(import.meta.dirname, `${e}.html`)])) },
  },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
})
