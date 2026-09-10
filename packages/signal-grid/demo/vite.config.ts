import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"

// Root is this directory; `outDir` stays inside the demo rather than colliding with `dist/`.
// `base: "/"` because the four routes are pathnames and a relative base breaks their asset urls.
const here = fileURLToPath(new URL(".", import.meta.url))

export default defineConfig({
  root: here,
  base: "/",
  build: { outDir: "dist", emptyOutDir: true, target: "es2022" },
  server: { port: 5179, strictPort: true },
})
