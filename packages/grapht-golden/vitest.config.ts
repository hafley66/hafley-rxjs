import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const packageRoot = fileURLToPath(new URL(".", import.meta.url))
const repositoryRoot = resolve(packageRoot, "../..")

export default defineConfig({
  resolve: {
    alias: {
      "@hafley66/grapht/browser": resolve(repositoryRoot, "packages/grapht/src/browser.ts"),
      "@hafley66/grapht-model": resolve(repositoryRoot, "packages/grapht-model/src/index.ts"),
      "@hafley66/mmd/browser": resolve(repositoryRoot, "packages/mmd/src/6_browser.ts"),
      "@hafley66/d2/browser": resolve(repositoryRoot, "packages/d2/src/6_browser.ts"),
      "@hafley66/grapht-render-cytoscape": resolve(repositoryRoot, "packages/grapht/adapters/2_render_cytoscape/index.ts"),
      "@hafley66/grapht-render-pixijs": resolve(repositoryRoot, "packages/grapht/adapters/6_render_pixijs/src/index.ts"),
    },
  },
})
