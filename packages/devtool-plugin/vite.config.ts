import react from "@vitejs/plugin-react"
import { resolve } from "node:path"
import dts from "vite-plugin-dts"
import { defineConfig } from "vite"
import { rxjsHmrPlugin } from "./src/1_runtime_vite_plugin/1_rxjs_hmr_plugin"
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig(({ command }) => ({
  build: {
    lib: {
      entry: "./src/index.ts",
      name: "ObservableTracker",
      fileName: format => `index.${format === "es" ? "js" : format}`,
      formats: ["es"],
    },
    rollupOptions: {
      external: [],
    },
    sourcemap: true,
    target: "esnext",
  },
  plugins: [
    ...(command === "build"
      ? [dts({ include: ["src/**/*.ts"], exclude: ["src/**/*.test.ts"], entryRoot: "src", outDir: resolve(__dirname, "dist") })]
      : []),
    react(),
    rxjsHmrPlugin({ debug: false }),
    tsconfigPaths(),
  ],
  optimizeDeps: {
    exclude: ["rxjs", "rxjs/operators"],
  },
}))
