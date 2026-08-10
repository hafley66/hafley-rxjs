import { createLibConfig } from '../../vite.lib.config'
import { resolve } from 'path'

export default createLibConfig(__dirname, undefined, {
  index: resolve(__dirname, 'src/index.ts'),
  '3_react': resolve(__dirname, 'src/3_react.ts'),
  'jsx-runtime': resolve(__dirname, 'src/jsx-runtime.ts'),
  'jsx-dev-runtime': resolve(__dirname, 'src/jsx-dev-runtime.ts'),
  'vite-plugin': resolve(__dirname, 'src/vite-plugin.ts'),
})
