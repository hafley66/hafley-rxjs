import { defineConfig } from "vite"
import { resolve } from "path"
import { createLibConfig } from "../../vite.lib.config"

const base = createLibConfig(__dirname, undefined, {
  index: resolve(__dirname, "src/index.ts"),
})

export default defineConfig((env) => {
  const config = typeof base === "function" ? base(env) : base
  return {
    ...config,
    test: {
      ...config.test,
      // DOM primitives (syncScroll, phantomScrollbar) need an element model.
      environment: "jsdom",
    },
  }
})
