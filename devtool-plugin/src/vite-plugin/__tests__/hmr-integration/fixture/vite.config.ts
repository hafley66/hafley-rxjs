import path from "path"
import { defineConfig } from "rolldown-vite"
import { rxjsHmrPlugin } from "../../../1_rxjs_hmr_plugin"

export default defineConfig({
  root: __dirname,
  plugins: [
    rxjsHmrPlugin({
      debug: true,
      // Point to actual module paths relative to project root
      patchModulePath: path.resolve(__dirname, "../../../../tracking/v2/01.patch-observable"),
      hmrModulePath: path.resolve(__dirname, "../../../../tracking/v2/hmr/4_module-scope"),
    }),
  ],
  optimizeDeps: {
    exclude: ["rxjs"],
  },
  server: {
    hmr: true,
  },
})
