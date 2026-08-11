import { createReadStream } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"

const fixtureRoot = resolve(fileURLToPath(new URL("../../.cache/render-fixtures", import.meta.url)))
export default defineConfig({
  root: ".",
  publicDir: false,
  server: { port: 4174 },
  plugins: [{ name: "grapht-common-fixtures", configureServer(server) {
    server.middlewares.use("/common-fixtures", (request, response, next) => {
      const name = request.url?.slice(1) ?? ""
      if (!/^grid-\d+\.json$/.test(name)) return next()
      response.setHeader("Content-Type", "application/json")
      createReadStream(resolve(fixtureRoot, name)).on("error", next).pipe(response)
    })
  } }],
  build: { rollupOptions: { input: "5_index.html" } },
})
