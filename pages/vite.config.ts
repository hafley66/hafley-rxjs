import { fileURLToPath } from "node:url"
import { defineConfig, type Plugin } from "vite"
import { SITES } from "./manifest.ts"

const here = fileURLToPath(new URL(".", import.meta.url))
const pkg = (tail: string): string => fileURLToPath(new URL(`../packages/${tail}`, import.meta.url))

// `pages/` sits at the repository root, outside `packages/*`, so pnpm never links the workspace
// packages into a node_modules beside it. These three aliases are that link, written out. Two of
// them point at built output on purpose: `dist` keeps React off the shell's module graph, and keeps
// `tsc -p pages/tsconfig.json` reading a `.d.ts` instead of another package's sources.
const alias = [
  { find: /^@hafley66\/report-shell\/kit\.css$/, replacement: pkg("report-shell/src/kit.css") },
  { find: /^@hafley66\/report-shell\/tips$/, replacement: pkg("report-shell/dist/lib/tips.js") },
  { find: /^@hafley66\/signals$/, replacement: pkg("signals/dist/index.js") },
]

/**
 * Inlines the root redirect into `<head>`, ahead of the module script.
 *
 * A bookmark of `https://hafley66.github.io/hafley-rxjs/#/icons` predates the shell and has to keep
 * landing on gothic's icons view. Running the test from `main.ts` would work but only after the
 * module downloads, which is a visible flash of the hub. Inline and synchronous, it fires before the
 * body is parsed. The route list is serialized out of the manifest, so no route is duplicated here.
 */
function inlineRedirect(): Plugin {
  const owners = SITES.filter(it => (it.hashRoutes ?? []).length > 0).map(it => [it.slug, it.hashRoutes ?? []])
  const script = `<script>(function () {
  var owners = ${JSON.stringify(owners)}
  var hash = location.hash
  if (hash.length < 3) return
  var raw = hash.slice(1)
  var cut = raw.indexOf("?")
  var path = cut < 0 ? raw : raw.slice(0, cut)
  if (path.length > 1 && path.charAt(path.length - 1) === "/") path = path.slice(0, -1)
  for (var index = 0; index < owners.length; index++) {
    var routes = owners[index][1]
    for (var inner = 0; inner < routes.length; inner++) {
      if (path === routes[inner] || path.indexOf(routes[inner] + "/") === 0) {
        var base = location.pathname
        if (base.charAt(base.length - 1) !== "/") base = base.replace(/[^/]*$/, "")
        location.replace(base + owners[index][0] + "/" + hash)
        return
      }
    }
  }
})()</` + `script>`
  return {
    name: "pages-inline-redirect",
    transformIndexHtml: {
      order: "pre",
      handler: (html: string) => html.replace("<!-- pages:redirect -->", script),
    },
  }
}

// Two builds land in the same `dist`: the shell (default mode) and `strip.js` (`--mode strip`),
// which is an IIFE with the manifest inlined so a package site loads it with one tag and no
// resolution step. `scripts/pages.mjs` runs them in that order; only the first empties the folder.
export default defineConfig(({ mode }) =>
  mode === "strip"
    ? {
        root: here,
        resolve: { alias },
        build: {
          outDir: "dist",
          emptyOutDir: false,
          target: "es2019",
          lib: { entry: fileURLToPath(new URL("./strip.ts", import.meta.url)), formats: ["iife"], name: "PagesStrip", fileName: () => "strip.js" },
        },
      }
    : {
        root: here,
        // Relative, so the same build serves from `/hafley-rxjs/` on Pages and from any prefix a
        // local preview picks. Nothing in the shell is a deep pathname route.
        base: "./",
        plugins: [inlineRedirect()],
        resolve: { alias },
        build: { outDir: "dist", assetsDir: "shell", emptyOutDir: true, target: "es2022" },
        server: { port: 5190, strictPort: true },
      },
)
