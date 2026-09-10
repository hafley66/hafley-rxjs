import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"

// The serve slot recomputes outDir as `resolve(build.root, build.build?.outDir ?? "dist")`, so root
// and outDir have to agree with what vitest.e2e.config.ts passes or preview serves an empty tree.
const here = fileURLToPath(new URL(".", import.meta.url))

export default defineConfig({
  root: here,
  base: "./",
  build: { outDir: "dist", emptyOutDir: true, target: "es2022", minify: false },
})
