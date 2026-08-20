import { resolve } from "path"
import { createLibConfig } from "../../vite.lib.config"

export default createLibConfig(__dirname, undefined, {
  index: resolve(__dirname, "src/index.ts"),
  pixi: resolve(__dirname, "src/pixi.ts"),
})
