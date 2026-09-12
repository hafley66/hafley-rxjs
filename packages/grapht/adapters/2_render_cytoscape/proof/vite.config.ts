import { defineConfig } from "vite"

export default defineConfig({
  root: __dirname,
  optimizeDeps: { include: ["cytoscape", "dompurify"] },
  server: { port: 5179 },
})
