import { resolve } from "node:path";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: {
    "@hafley66/signals": resolve(import.meta.dirname, "src/test/0_signalsRuntime.ts"),
    "@hafley66/trace": resolve(import.meta.dirname, "../trace/src/index.ts"),
  } },
  test: {
    maxWorkers: 1,
    fileParallelism: false,
    include: ["src/**/*.browser.test.ts"],
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: "chromium", viewport: { width: 1280, height: 800 } }],
      headless: true,
    },
    testTimeout: 15_000,
  },
});
