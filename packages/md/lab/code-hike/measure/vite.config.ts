import { resolve } from "node:path"
import { defineConfig } from "vite"
import { lighterLocalAlias } from "../0_lighterAlias.js"

// One library build per engine entry, react external, so each entry's eager bytes and its lazy
// chunks (grammars, themes, wasm) are attributable. Numbers land in the plan's lab section.
const entry = process.env.LAB_ENTRY ?? "a_codehikeCode"
export default defineConfig({
  resolve: { alias: process.env.LIGHTER_NETWORK === "1" ? {} : lighterLocalAlias },
  build: {
    lib: { entry: resolve(import.meta.dirname, `${entry}.ts`), formats: ["es"], fileName: entry },
    rollupOptions: { external: [/^react($|\/)/, /^react-dom($|\/)/] },
    outDir: resolve(import.meta.dirname, `../../../out/lab/measure/${entry}`),
    emptyOutDir: true,
    minify: true,
  },
})
