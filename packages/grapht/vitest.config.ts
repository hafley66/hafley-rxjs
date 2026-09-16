import { configDefaults, defineConfig } from "vitest/config"

// `tests/*.e2e.test.ts` is the site suite: it reads a baseURL only `vitest.site.config.ts`'s serve
// slot provides, and a bare `vitest run tests` (this package's own `test` script) would collect it
// with none and fail on it. Naming it here scopes it to its own runner instead. The default excludes
// are restated rather than replaced, so this config changes nothing else about the default run.
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "tests/*.e2e.test.ts"],
  },
})