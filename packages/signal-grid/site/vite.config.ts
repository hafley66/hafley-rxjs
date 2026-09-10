import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig, type Plugin } from "vite"

// Root is this directory, so `index.html` beside it is the entry and `outDir` stays inside the
// site rather than colliding with the package's library build in `dist/`.
const here = fileURLToPath(new URL(".", import.meta.url))
const pkg = fileURLToPath(new URL("..", import.meta.url))
const workspace = fileURLToPath(new URL("../../..", import.meta.url))

/** github.io serves gothic at `/hafley-rxjs/`, so this site takes a subdirectory under it. */
export const BASE = "/hafley-rxjs/signal-grid/"

/** Puts back the resolution error `import.meta.glob` in `content.ts` swallows, at `buildStart`. */
function checkPages(): Plugin {
  return {
    name: "signal-grid-site-pages",
    buildStart() {
      const file = resolve(here, "content.ts")
      const source = readFileSync(file, "utf8")
      const paths = [...source.matchAll(/path:\s*"([^"]+\.md)"/g)].map((match) => match[1] ?? "")
      if (paths.length === 0) throw new Error("site/content.ts declares no pages")
      const missing = paths.filter((path) => !existsSync(resolve(here, path)))
      if (missing.length > 0) {
        throw new Error(`site/content.ts lists ${missing.length} page(s) with no file:\n  ${missing.join("\n  ")}`)
      }
      if (!existsSync(resolve(here, "stats.json"))) {
        throw new Error("site/stats.json is absent. Run `node scripts/stats.mjs` (or `pnpm ship`, which runs it first).")
      }
      this.info(`${paths.length} pages, every source file present`)
    },
  }
}

export default defineConfig({
  root: here,
  // Project page under the gothic root, so every asset resolves under this prefix and a deep link
  // like `/hafley-rxjs/signal-grid/parity` still finds `assets/`. `main.ts` strips it back off.
  base: BASE,
  plugins: [checkPages()],
  build: { outDir: "dist", emptyOutDir: true, target: "es2022" },
  // The markdown lives in `docs/`, `bench/`, and the package README, all outside this root, so the
  // dev server has to be allowed to read them for the `?raw` imports to resolve.
  server: { port: 5180, strictPort: true, fs: { allow: [pkg, workspace] } },
  preview: { port: 5181, strictPort: true },
})
