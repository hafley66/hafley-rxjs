import { defineConfig } from "vitest/config"

// Split from vite.config.ts, whose only job is the library build. `include` reproduces what the
// default glob already collected: the jsx-e2e suite has its own config and its own environment.
const logging = !!process.env.SIGNALS_LOG && process.env.SIGNALS_LOG !== "0"

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    // The default reporter swallows console output from passing tests, which is every test here.
    ...(logging ? { reporters: ["verbose" as const] } : {}),
  },
})
