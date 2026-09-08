// pkg:plugin in the tel:plugin shape: config() returns test.{setupFiles, globalSetup, provide, isolate, runner}
// and mirrors the serve options into process.env for the vitest:globalSetup process.
import { fileURLToPath } from "node:url"
import type { Plugin } from "vite"
import { KEY, resolveOptions, type VitestPlaywrightOptions } from "./0_options.js"

function siblingPath(name: string): string {
  const extension = import.meta.url.endsWith(".ts") ? "ts" : "js"
  return fileURLToPath(new URL(`./${name}.${extension}`, import.meta.url))
}

export function vitestPlaywright(options: VitestPlaywrightOptions = {}): Plugin {
  const resolved = resolveOptions(options)
  const serve = options.serve ?? null
  // serve crosses into the vitest:globalSetup process as JSON; a vite InlineConfig with plugins cannot make that trip
  if (serve?.kind === "vite" && (serve.build as any).plugins)
    throw new Error("vitest-playwright: serve.build.plugins cannot cross into global setup; use build: { configFile }")
  return {
    name: "vitest-playwright",
    config(user: any) {
      process.env.VITEST_PLAYWRIGHT_SERVE = JSON.stringify(serve)
      const runner = siblingPath("9_runner")
      if (user.test?.runner && user.test.runner !== runner) throw new Error(`vitest-playwright: test.runner is already ${user.test.runner}; the plugin needs its own runner`)
      return {
        test: {
          setupFiles: [siblingPath("setup")],
          globalSetup: [siblingPath("2_global-setup")],
          provide: { [KEY.options]: resolved },
          isolate: user.test?.isolate ?? false,
          runner,
        },
      } as any
    },
  }
}
export type { VitestPlaywrightOptions, ResolvedOptions, ServeOptions } from "./0_options.js"
