import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import dts from "vite-plugin-dts"
import { defineConfig } from "vite"

const manifest = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}
const externals = Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies })

export default defineConfig({
  plugins: [dts({
    include: ["index.ts", "4_adapter.ts", "0_protocol.ts", "1_projection.ts", "3_fixture.ts", "6_graphRenderer.ts", "bin/**/*.ts"],
    entryRoot: ".",
    outDirs: resolve(import.meta.dirname, "dist"),
    compilerOptions: { rootDir: resolve(import.meta.dirname, "../..") },
    beforeWriteFile(filePath, content) {
      const declaration = content.replace(/(from ['"]\.[^'"]+)\.ts(['"])/g, "$1.js$2")
      if (!filePath.endsWith("/6_graphRenderer.d.ts")) return { content: declaration }
      const sourceImports = [
        "import { WheelSettings } from '../../src/lib/1_wheelCamera.js';",
        "import { GraphStyleInput } from '../../src/lib/0_graphStyle.js';",
        "import { StickyOptions } from '../../src/lib/0_stickyOverlay.js';",
      ]
      if (!sourceImports.every((line) => declaration.includes(line))) throw new Error("Unexpected graph renderer declaration imports")
      return { content: declaration
        .replace(sourceImports[0], 'import type { WheelSettings, GraphStyleInput } from "@hafley66/grapht/browser";')
        .replace(sourceImports[1], "")
        .replace(sourceImports[2], "type StickyOptions = { inset?: number; fullWidth?: number; chipWidth?: number; gap?: number; height?: number; ribbon?: boolean; groups?: boolean };") }
    },
  })],
  build: {
    lib: {
      entry: {
        index: resolve(import.meta.dirname, "index.ts"),
        "4_adapter": resolve(import.meta.dirname, "4_adapter.ts"),
        "bin/grapht-adapter-render-cytoscape": resolve(import.meta.dirname, "bin/grapht-adapter-render-cytoscape.ts"),
      },
      formats: ["es"],
      fileName: (_format, name) => `${name}.js`,
    },
    rollupOptions: {
      external: (id) => id.startsWith("node:") || externals.some((name) => id === name || id.startsWith(`${name}/`)),
    },
    outDir: resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    sourcemap: true,
    minify: false,
  },
})
