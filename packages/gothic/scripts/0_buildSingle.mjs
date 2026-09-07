// one vite build per entry, each inlined into a single html (vite-plugin-singlefile refuses multi-entry), so file:// works
import { build } from "vite"
import { viteSingleFile } from "vite-plugin-singlefile"

const root = new URL("..", import.meta.url).pathname
const entries = ["eye", "slice", "icons", "border", "fractal"]
let first = true
for (const e of entries) {
  await build({
    configFile: false,
    root,
    logLevel: "warn",
    plugins: [viteSingleFile()],
    build: { outDir: "dist", emptyOutDir: first, rollupOptions: { input: `${root}${e}.html` } },
  })
  first = false
  console.log("built dist/" + e + ".html")
}
