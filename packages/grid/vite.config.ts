import { createLibConfig } from '../../vite.lib.config'
import { resolve } from 'path'

const config = createLibConfig(__dirname)
if (config.build?.lib) {
  config.build.lib.entry = {
    index: resolve(__dirname, 'src/index.ts'),
    '3_react': resolve(__dirname, 'src/3_react.ts'),
  }
}
config.test = {
  environment: "node",
  exclude: ["**/node_modules/**", "**/dist/**", "**/*.browser.test.{ts,tsx}"],
}

export default config
