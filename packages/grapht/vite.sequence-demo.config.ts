import { defineConfig } from "vite"

import { sequenceDemoMiddleware } from "./demo/0_server.js"

export default defineConfig({
  root: new URL("./demo", import.meta.url).pathname,
  plugins: [{
    name: "sequence-demo-api",
    configureServer(server) {
      server.middlewares.use(sequenceDemoMiddleware())
    },
  }],
  server: {
    host: "127.0.0.1",
    port: 4178,
  },
})
