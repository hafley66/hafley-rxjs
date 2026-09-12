import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"

// Unminified on purpose: a profile taken against this build has to name the package's own functions.
const here = fileURLToPath(new URL(".", import.meta.url))

export default defineConfig({
  root: here,
  base: "./",
  build: { outDir: "dist", emptyOutDir: true, target: "es2022", minify: false },
})
