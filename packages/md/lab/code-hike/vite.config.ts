import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { lighterLocalAlias } from "./0_lighterAlias.js"

// Code Hike lab. `vite lab/code-hike` serves it; `vite build lab/code-hike` writes
// out/lab/code-hike, whose chunk sizes are the bundle-cost numbers in the plan.
export default defineConfig({
  plugins: [react()],
  resolve: { dedupe: ["react", "react-dom"], alias: process.env.LIGHTER_NETWORK === "1" ? {} : lighterLocalAlias },
  build: { outDir: "../../out/lab/code-hike", emptyOutDir: true, chunkSizeWarningLimit: 12_000 },
  server: { fs: { allow: ["../.."] } },
})
