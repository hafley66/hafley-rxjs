import { defineConfig } from "vite"
import { visualizer } from "rollup-plugin-visualizer"
import dts from "vite-plugin-dts"

// Behind `SIGNAL_GRID_TREEMAP=1` because it costs more than the build it reports on: 24 ms per
// bundle without the plugin, 84 ms with it, measured three runs each on 2026-09-10.
const treemap = process.env.SIGNAL_GRID_TREEMAP === "1"

export default defineConfig({
  plugins: [dts({
    include: ["src/**/*.ts", "src/**/*.tsx"],
    exclude: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    entryRoot: "src",
  }), ...(treemap
    ? [
        visualizer({
          filename: "out/treemap.html",
          title: "@hafley66/signal-grid dist",
          gzipSize: true,
          brotliSize: true,
        }),
      ]
    : [])],
  build: {
    lib: {
      entry: { index: "src/index.ts", react: "src/react/index.tsx" },
      formats: ["es"],
    },
    rollupOptions: {
      external: [/^@hafley66\//, "rxjs", /^rxjs\//, "react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    },
  },
})
