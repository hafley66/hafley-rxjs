import { defineConfig } from "vitest/config"

// Raw playwright against the already-built dist/index.html (`pnpm build:single`), no dev server, chromium headless.
export default defineConfig({
  test: {
    include: ["tests/app.e2e.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 30_000,
  },
})
