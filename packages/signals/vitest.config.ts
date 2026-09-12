import { defineConfig } from "vitest/config"

// DOM tests live in the browser runner (`vitest.browser.config.ts`), never under jsdom. Named one
// path at a time rather than globbed onto a `*.browser.test.ts` suffix, so a file can sit in only
// one runner. `vitest.browser.config.ts` imports the same array as its include.
export const BROWSER_TESTS: readonly string[] = [
  "src/4_jsxAuto.render.browser.test.ts",
  "src/5_Route.browser.test.ts",
  "src/6_Storage.browser.test.ts",
]

// Split from vite.config.ts, whose only job is the library build. `include` reproduces what the
// default glob already collected: the jsx-e2e suite has its own config and its own environment.
const logging = !!process.env.SIGNALS_LOG && process.env.SIGNALS_LOG !== "0"

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: [...BROWSER_TESTS],
    setupFiles: ["./vitest.setup.ts"],
    // The default reporter swallows console output from passing tests, which is every test here.
    ...(logging ? { reporters: ["verbose" as const] } : {}),
  },
})
