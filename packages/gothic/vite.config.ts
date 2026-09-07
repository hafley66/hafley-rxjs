import tailwind from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { viteSingleFile } from "vite-plugin-singlefile"
import { defineConfig } from "vitest/config"

// mode "single": one inlined index.html that runs from file:// (the app switches to hash routing there)
export default defineConfig(({ mode }) => ({
  base: mode === "single" ? "./" : "/",
  plugins: [react(), tailwind(), ...(mode === "single" ? [viteSingleFile()] : [])],
  build: { outDir: "dist", emptyOutDir: true, chunkSizeWarningLimit: 4000 },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
}))
