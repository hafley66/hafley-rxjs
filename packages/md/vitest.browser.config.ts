import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  // streamdown and md resolve react through pnpm isolation; one copy or hooks read null dispatchers
  resolve: { dedupe: ["react", "react-dom"] },
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: "chromium", viewport: { width: 1280, height: 800 } }],
      headless: true,
      screenshotFailures: true,
    },
    include: [
      "src/0b_SequenceDiagram.render.test.tsx",
      "src/0b_sequenceSource.test.ts",
      "src/0_DiagramLightbox.render.test.tsx",
    ],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
