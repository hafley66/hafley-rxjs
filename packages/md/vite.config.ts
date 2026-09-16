import { resolve } from "node:path"
import { defineConfig } from "vite"
import dts from "vite-plugin-dts"

export default defineConfig({
  plugins: [dts({
    include: ["src/**/*.ts", "src/**/*.tsx"],
    exclude: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Declarations must land at dist/index.d.ts: `exports["."].types` names that path, and
    // without an entry root the emit adds a `src/` segment that nothing points at.
    entryRoot: "src",
    outDir: resolve(import.meta.dirname, "dist"),
  })],
  build: {
    lib: {
      entry: resolve(import.meta.dirname, "src/index.ts"),
      formats: ["es"],
      fileName: () => "index.js",
      cssFileName: "style",
    },
    rollupOptions: {
      external: (id) => !id.startsWith(".") && !id.startsWith("/"),
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
