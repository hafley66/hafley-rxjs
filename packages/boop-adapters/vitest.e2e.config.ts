import { defineConfig } from "vitest/config"

// Raw playwright against the already-built out/boop-network.html: no @playwright/test runner,
// no dev server, chromium headless.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "network-e2e",
          include: ["tests/network.e2e.test.ts"],
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
})
