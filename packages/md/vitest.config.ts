import { defineConfig } from "vitest/config";

// The sequence integration test drives mermaid, @terrastruct/d2, cytoscape, and
// SVGGraphicsElement measurement, none of which jsdom implements.
export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "src/0b_SequenceDiagram.render.test.tsx"],
    // The d2 wasm module boots once per worker and exceeds the 5s default when
    // the whole suite starts its files at the same time.
    testTimeout: 30_000,
  },
});
