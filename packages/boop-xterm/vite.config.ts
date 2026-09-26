import { resolve } from "node:path"
import { defineConfig } from "vite"
import dts from "vite-plugin-dts"

export default defineConfig({
  plugins: [dts({
    include: ["src/**/*.ts"],
    exclude: ["src/**/*.test.ts", "src/test/**"],
    entryRoot: "src",
    outDir: resolve(import.meta.dirname, "dist"),
  })],
  build: {
    lib: {
      entry: resolve(import.meta.dirname, "src/index.ts"),
      formats: ["es"],
      fileName: (_format, name) => `${name}.js`,
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
