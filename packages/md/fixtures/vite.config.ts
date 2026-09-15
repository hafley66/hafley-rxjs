import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// The e2e fixture build: this directory is the root, index.html + main.tsx the
// entry. The panel is imported from ../src, so a source edit shows without a
// package build. md resolves react through pnpm isolation; one copy or hooks
// read null dispatchers.
export default defineConfig({
  plugins: [react()],
  resolve: { dedupe: ["react", "react-dom"] },
  build: { outDir: "../out/fixture", emptyOutDir: true, chunkSizeWarningLimit: 12_000 },
  server: { fs: { allow: [".."] } },
})
