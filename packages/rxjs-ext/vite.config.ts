import { defineConfig } from "vite"
import { createLibConfig } from "../../vite.lib.config"

export default defineConfig((env) => {
  const config = createLibConfig(__dirname)(env)
  config.test = { ...config.test, passWithNoTests: true }
  return config
})
