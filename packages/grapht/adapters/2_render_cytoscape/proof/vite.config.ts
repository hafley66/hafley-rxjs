import { defineConfig } from "vite"

export default defineConfig({
  root: __dirname,
  optimizeDeps: { include: ["cytoscape", "cytoscape-fcose", "dompurify"] },
  server: { port: 5179 },
})
