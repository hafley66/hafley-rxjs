import { createReadStream } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"
import { sequenceDemoMiddleware } from "../../demo/0_server.ts"

const fixtureRoot = resolve(fileURLToPath(new URL("../../.cache/render-fixtures", import.meta.url)))
const sceneSource = resolve(fileURLToPath(new URL("../../../scene/src", import.meta.url)))

export default defineConfig({
  root: ".",
  publicDir: false,
  resolve: {
    alias: [
      { find: "@hafley66/scene/pixi", replacement: resolve(sceneSource, "pixi.ts") },
      { find: "@hafley66/scene", replacement: resolve(sceneSource, "index.ts") },
    ],
  },
  plugins: [{ name: "grapht-common-fixtures", configureServer(server) {
    server.middlewares.use(sequenceDemoMiddleware())
    server.middlewares.use("/common-fixtures", (request, response, next) => {
      const name = request.url?.slice(1) ?? ""
      if (!/^grid-\d+\.json$/.test(name)) return next()
      response.setHeader("Content-Type", "application/json")
      createReadStream(resolve(fixtureRoot, name)).on("error", next).pipe(response)
    })
  } }],
  build: { outDir: "dist", emptyOutDir: true },
})
