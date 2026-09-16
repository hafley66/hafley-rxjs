import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// The demo's address is part of the package: 5391 unless something else on the machine has it, in
// which case vite picks the next free one and prints it.
export default defineConfig({
  plugins: [react()],
  server: { host: "127.0.0.1", port: 5391 },
})
