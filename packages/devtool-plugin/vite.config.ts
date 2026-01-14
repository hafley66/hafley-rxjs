import react from "@vitejs/plugin-react"
import { defineConfig } from "rolldown-vite"
import { rxjsHmrPlugin } from "./src/vite-plugin/1_rxjs_hmr_plugin"

export default defineConfig({
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
  plugins: [react(), rxjsHmrPlugin({ debug: true })],
  optimizeDeps: {
    exclude: ["rxjs"],
  },
})
