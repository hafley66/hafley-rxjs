import { resolve } from "node:path"
import { defineConfig } from "vite"
import dts from "vite-plugin-dts"

export default defineConfig({
  plugins: [dts({
    include: ["src/**/*.ts", "src/**/*.tsx"],
    exclude: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/**/*.fixture.ts"],
    // Declarations must land at dist/index.d.ts: `exports["."].types` names that path, and
    // without an entry root the emit adds a `src/` segment that nothing points at.
    entryRoot: "src",
    outDir: resolve(import.meta.dirname, "dist"),
  })],
  build: {
    lib: {
      entry: {
        index: resolve(import.meta.dirname, "src/index.ts"),
        "plugins/index": resolve(import.meta.dirname, "src/plugins/index.ts"),
        "plugins/marbles": resolve(import.meta.dirname, "src/plugins/marbles.ts"),
        "plugins/steps": resolve(import.meta.dirname, "src/plugins/steps.ts"),
        "plugins/fs-tree": resolve(import.meta.dirname, "src/plugins/fs-tree.ts"),
      },
      formats: ["es"],
      fileName: (_format, name) => `${name}.js`,
      cssFileName: "style",
    },
    rollupOptions: {
      external: (id) => !id.startsWith(".") && !id.startsWith("/")
        && !(process.env.LOCAL_MD_BUNDLE === "1" && /^@hafley66\/(?:grapht(?:-model|-render-cytoscape)?|mmd|d2)(?:\/|$)/.test(id)),
      output: {
        preserveModules: true,
        preserveModulesRoot: "src",
        entryFileNames: "[name].js",
        minifyInternalExports: false,
      },
      preserveEntrySignatures: "strict",
    },
    outDir: resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    sourcemap: true,
    minify: false,
  },
})
