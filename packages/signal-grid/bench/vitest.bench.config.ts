import { readdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const here = dirname(fileURLToPath(import.meta.url))
const pkg = resolve(here, "..")
const store = resolve(pkg, "../../node_modules/.pnpm")

// `@tanstack/table-core` is in the pnpm store as a transitive of `@tanstack/react-table`, but is
// never linked into `packages/signal-grid/node_modules`. Delete both aliases once the package
// devDependencies carry `"@tanstack/table-core": "9.1.0"`.
const tableCore = (): string => {
  const hits = readdirSync(store)
    .filter((name) => name.startsWith("@tanstack+table-core@"))
    .sort()
  const last = hits[hits.length - 1]
  if (last === undefined) throw new Error("no @tanstack/table-core in " + store)
  return resolve(store, last, "node_modules/@tanstack/table-core")
}

const core = tableCore()

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@tanstack/table-core/store-reactivity-bindings",
        replacement: resolve(core, "dist/store-reactivity-bindings.js"),
      },
      { find: "@tanstack/table-core", replacement: resolve(core, "dist/index.js") },
    ],
  },
  test: {
    root: pkg,
    benchmark: {
      include: ["bench/**/*.bench.ts"],
      // Set, but vitest 4.1.10 drops it before the worker sees it. `bench/4_report.ts` is the p95.
      includeSamples: true,
      outputJson: "bench/results.json",
    },
  },
})
