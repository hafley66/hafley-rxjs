import tailwind from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { viteSingleFile } from "vite-plugin-singlefile"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// the kit resolves to its source so a kit edit shows in dev/build/tests without `pnpm --filter @hafley66/report-shell build`;
// css subpaths follow; the marbler subpath stays on the package exports (unused here)
const kitSrc = fileURLToPath(new URL("../report-shell/src/", import.meta.url))

// mode "single": one inlined index.html that runs from file:// (the app switches to hash routing there)
export default defineConfig(({ mode }) => ({
  base: mode === "single" ? "./" : "/",
  resolve: {
    alias: [
      { find: /^@hafley66\/report-shell$/, replacement: `${kitSrc}index.ts` },
      { find: /^@hafley66\/report-shell\/(kit|style|marbler)\.css$/, replacement: `${kitSrc}$1.css` },
    ],
  },
  plugins: [react(), tailwind(), ...(mode === "single" ? [viteSingleFile()] : [])],
  build: { outDir: "dist", emptyOutDir: true, chunkSizeWarningLimit: 4000 },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
}))
