import { defineConfig } from "vite"
import { resolve } from "path"
import { readFileSync } from "fs"
import dts from "vite-plugin-dts"
import react from "@vitejs/plugin-react"

const pkg = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf-8"))
const external = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
]

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    ...(command === "build"
      ? [dts({
          include: ["src/**/*.ts", "src/**/*.tsx"],
          exclude: ["src/**/*.test.ts", "src/**/*.test.tsx"],
          outDir: resolve(__dirname, "dist"),
        })]
      : []),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        "react/index": resolve(__dirname, "src/react/index.ts"),
      },
      formats: ["es"],
      fileName: () => "[name].js",
    },
    rollupOptions: {
      external: (id) => {
        if (id.includes("node_modules")) return true
        if (!id.startsWith(".") && !id.startsWith("/")) {
          return external.some(dep => id.startsWith(dep))
        }
        return false
      },
      output: {
        preserveModules: true,
        preserveModulesRoot: "src",
        entryFileNames: "[name].js",
        minify: false,
        keepNames: true,
        minifyInternalExports: false,
      },
    },
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
    sourcemap: true,
    minify: false,
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: [resolve(__dirname, "../../vitest.setup.ts")],
  },
}))
