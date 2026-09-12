import { fileURLToPath } from "node:url"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// Unminified on purpose: a profile taken against this build has to name the package's own functions.
const here = fileURLToPath(new URL(".", import.meta.url))

const page = (name: string): string => fileURLToPath(new URL(name, import.meta.url))

export default defineConfig({
  root: here,
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
    minify: false,
    rollupOptions: {
      input: {
        index: page("index.html"),
        gallery: page("gallery.html"),
        knobs: page("knobs.html"),
        react: page("react.html"),
        mui: page("mui.html"),
      },
    },
  },
})
