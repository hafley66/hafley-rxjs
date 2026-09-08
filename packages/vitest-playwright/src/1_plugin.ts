// pkg:plugin in the tel:plugin shape: config() returns test.{setupFiles, globalSetup, provide, isolate, runner}
// and mirrors the serve options into process.env for the vitest:globalSetup process.
import { fileURLToPath } from "node:url"
import type { Plugin, UserConfig } from "vite"
import { KEY, resolveOptions, type VitestPlaywrightOptions } from "./0_options.js"

// vitest: the `test` block of a vite config. Declared locally: importing "vitest/config" types drags @vitest/browser's
// jest-dom Assertion augmentation into every consumer program and collides with the playwright matcher names.
type TestBlock = {
  runner?: string
  isolate?: boolean
  setupFiles?: string[]
  globalSetup?: string[]
  provide?: Record<string, unknown>
}
type WithTest = UserConfig & { test?: TestBlock }
// The plugin with its config hook pinned to the plain-function form so callers and tests can invoke it directly.
export type VitestPlaywrightPlugin = Plugin & { config: (user: WithTest) => WithTest }

// Resolves a sibling module by name with this module's own extension: '.js' from dist/, '.ts' from src/.
function siblingPath(name: string): string {
  const extension = import.meta.url.endsWith(".ts") ? "ts" : "js"
  return fileURLToPath(new URL(`./${name}.${extension}`, import.meta.url))
}

export function vitestPlaywright(options: VitestPlaywrightOptions = {}): VitestPlaywrightPlugin {
  const resolved = resolveOptions(options)
  const serve = options.serve ?? null
  // serve crosses into the vitest:globalSetup process as JSON; a vite InlineConfig with plugins cannot make that trip
  if (serve?.kind === "vite" && serve.build.plugins)
    throw new Error("vitest-playwright: serve.build.plugins cannot cross into global setup; use build: { configFile }")
  return {
    name: "vitest-playwright",
    config(user: WithTest): WithTest {
      process.env.VITEST_PLAYWRIGHT_SERVE = JSON.stringify(serve)
      const runner = siblingPath("9_runner")
      if (user.test?.runner && user.test.runner !== runner)
        throw new Error(
          `vitest-playwright: test.runner is already ${user.test.runner}; the plugin needs its own runner`,
        )
      return {
        test: {
          setupFiles: [siblingPath("setup")],
          globalSetup: [siblingPath("2_global-setup")],
          provide: { [KEY.options]: resolved },
          isolate: user.test?.isolate ?? false,
          runner,
        },
      }
    },
  }
}
export type { ResolvedOptions, ServeOptions, VitestPlaywrightOptions } from "./0_options.js"
