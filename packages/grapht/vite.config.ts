import { resolve } from "node:path"
import dts from "vite-plugin-dts"
import { defineConfig } from "vite"

// Plain `defineConfig`, not the repo's `createLibConfig`: this package's build is
// `tsc -p tsconfig.build.json`, and its `dist` tree is resolved by path — `bin/*` and
// `scripts/7_boardSmoke.mjs` import `dist/0_bench/5_bench.js` and `dist/7_docHistory/2_cli.js`, which
// no entry graph reaches. A library build would replace that tree with the modules one entry imports
// and drop them, so this config owns exactly the one thing tsc emits nothing useful for: the React
// subpath, bundled to `dist/react.js` because that is what `"./react"` points at, with its own
// declarations written beside it. `emptyOutDir` stays false so the two builds add up to one `dist`.
export default defineConfig({
  plugins: [
    dts({
      include: ["src/4_board/react/**/*.tsx"],
      // The file beside the entry is a browser test, not a surface anyone imports.
      exclude: ["src/**/*.test.ts", "src/**/*.test.tsx"],
      // Rooted at `src` so the declaration mirrors the source path every other file in `dist` has,
      // and cannot land on top of the barrel's own `dist/index.d.ts`.
      entryRoot: "src",
      outDir: resolve(import.meta.dirname, "dist"),
    }),
  ],
  build: {
    lib: {
      entry: { react: resolve(import.meta.dirname, "src/4_board/react/index.tsx") },
      formats: ["es"],
    },
    outDir: resolve(import.meta.dirname, "dist"),
    emptyOutDir: false,
    sourcemap: true,
    minify: false,
    rollupOptions: {
      // React and the board's own dependencies are the consumer's, not this bundle's.
      external: [/^@hafley66\//, /^rxjs(\/|$)/, /^react(\/|$)/, /^react-dom(\/|$)/],
    },
  },
})
