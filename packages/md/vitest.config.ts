import { defineConfig } from "vitest/config";

// Pure model and wiring tests: no DOM environment here, and no jsdom anywhere in
// this package. Anything that renders runs in vitest browser mode
// (vitest.browser.config.ts) or as a page against fixtures/ (vitest.e2e.config.ts).
export default defineConfig({
  test: {
    maxWorkers: 1,
    fileParallelism: false,
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/out/**",
      "tests/**",
      "src/0_Streamdown.render.test.tsx",
      "src/1_reading.render.test.tsx",
      "src/**/*.browser.test.tsx",
      "src/lib/0_panelActivation.render.test.tsx",
      "src/0b_SequenceDiagram.render.test.tsx",
      "src/0b_sequenceSource.test.ts",
      "src/0_DiagramLightbox.render.test.tsx",
    ],
    // The d2 wasm module boots once per worker and exceeds the 5s default when
    // the whole suite starts its files at the same time.
    testTimeout: 30_000,
  },
});
