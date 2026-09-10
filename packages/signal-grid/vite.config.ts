import { defineConfig } from "vite"
import { visualizer } from "rollup-plugin-visualizer"

// Behind `SIGNAL_GRID_TREEMAP=1` because it costs more than the build it reports on: 24 ms per
// bundle without the plugin, 84 ms with it, measured three runs each on 2026-09-10.
const treemap = process.env.SIGNAL_GRID_TREEMAP === "1"

export default defineConfig({
  plugins: treemap
    ? [
        visualizer({
          filename: "out/treemap.html",
          title: "@hafley66/signal-grid dist",
          gzipSize: true,
          brotliSize: true,
        }),
      ]
    : [],
  build: {
    lib: {
      entry: { index: "src/index.ts" },
      formats: ["es"],
    },
    rollupOptions: {
      external: [/^@hafley66\//, "rxjs", /^rxjs\//],
    },
  },
})
