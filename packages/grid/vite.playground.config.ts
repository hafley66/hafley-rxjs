import { resolve } from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: resolve(__dirname, "playground.html"),
    },
  },
})
