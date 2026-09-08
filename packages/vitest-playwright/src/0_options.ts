// pkg:options. Data only: everything here crosses vitest:provide (structured clone) into workers,
// except `serve`, which only the vitest:globalSetup process reads (through process.env).
import type { BrowserContextOptions, LaunchOptions } from "playwright"
import type { InlineConfig } from "vite"

export type BrowserName = "chromium" | "firefox" | "webkit"
export type ScreenshotMode = "off" | "on" | "only-on-failure"
export type TraceMode = "off" | "on" | "retain-on-failure" | "on-first-retry"
export type VideoMode = "off" | "on" | "retain-on-failure"

export type ServeOptions =
  | { kind: "url"; url: string }
  | {
      kind: "command"
      command: string
      url: string
      cwd?: string
      env?: Record<string, string>
      readyTimeoutMs?: number
    }
  | {
      kind: "vite"
      build: InlineConfig
      mode?: string
      serve: "preview" | "file"
      entry?: string
      reuseExisting?: boolean
    }

export interface VitestPlaywrightOptions {
  browser?: {
    name?: BrowserName
    launch?: LaunchOptions
    connect?: { wsEndpoint: string; headers?: Record<string, string> }
  }
  /** pw:BrowserContextOptions, cloneable subset. `baseURL` here is the fallback when no serve slot provides one. */
  context?: BrowserContextOptions
  /** 'test' (default): context + page per test attempt. 'file': one context + page per file, sequential files only. */
  contextScope?: "test" | "file"
  expect?: { timeout?: number }
  timeouts?: { action?: number; navigation?: number }
  clock?: { install?: boolean; time?: number | string; mode?: "running" | "paused" | "fixed" }
  har?: { path: string; update?: boolean; url?: string | RegExp }
  artifacts?: { outDir?: string; screenshot?: ScreenshotMode; trace?: TraceMode; video?: VideoMode; budgetMs?: number }
  log?: { api?: boolean; page?: boolean; net?: boolean; failOnPageError?: boolean; failOnConsoleError?: boolean }
  serve?: ServeOptions
  testIdAttribute?: string
}

export interface ResolvedOptions {
  browser: {
    name: BrowserName
    launch: LaunchOptions
    connect?: { wsEndpoint: string; headers?: Record<string, string> }
  }
  context: BrowserContextOptions
  contextScope: "test" | "file"
  expectTimeout: number
  timeouts: { action: number; navigation: number }
  clock: { install: boolean; time?: number | string; mode: "running" | "paused" | "fixed" }
  har?: { path: string; update?: boolean; url?: { source: string; flags: string } }
  artifacts: { outDir: string; screenshot: ScreenshotMode; trace: TraceMode; video: VideoMode; budgetMs: number }
  log: { api: boolean; page: boolean; net: boolean; failOnPageError: boolean; failOnConsoleError: boolean }
  serveKind?: ServeOptions["kind"]
  testIdAttribute: string
}

/** vitest:provide serializes into workers; a function-valued option would silently vanish there. */
function cloneable<T>(value: T, path: string): T {
  try {
    structuredClone(value)
  } catch (e) {
    throw new Error(
      `vitest-playwright: ${path} must be structured-cloneable to reach test workers (${(e as Error).message})`,
    )
  }
  return value
}

export function resolveOptions(o: VitestPlaywrightOptions = {}): ResolvedOptions {
  return {
    browser: {
      name: o.browser?.name ?? "chromium",
      launch: cloneable(o.browser?.launch ?? {}, "browser.launch"),
      connect: o.browser?.connect,
    },
    context: cloneable(o.context ?? {}, "context"),
    contextScope: o.contextScope ?? "test",
    expectTimeout: o.expect?.timeout ?? 5000,
    timeouts: { action: o.timeouts?.action ?? 0, navigation: o.timeouts?.navigation ?? 0 },
    clock: { install: o.clock?.install ?? false, time: o.clock?.time, mode: o.clock?.mode ?? "running" },
    har: o.har
      ? {
          path: o.har.path,
          update: o.har.update,
          url:
            o.har.url instanceof RegExp
              ? { source: o.har.url.source, flags: o.har.url.flags }
              : o.har.url
                ? { source: o.har.url, flags: "" }
                : undefined,
        }
      : undefined,
    artifacts: {
      outDir: o.artifacts?.outDir ?? "out/pw",
      screenshot: o.artifacts?.screenshot ?? "only-on-failure",
      trace: o.artifacts?.trace ?? "retain-on-failure",
      video: o.artifacts?.video ?? "off",
      budgetMs: o.artifacts?.budgetMs ?? 5000,
    },
    log: {
      api: o.log?.api ?? true,
      page: o.log?.page ?? true,
      net: o.log?.net ?? true,
      failOnPageError: o.log?.failOnPageError ?? true,
      failOnConsoleError: o.log?.failOnConsoleError ?? true,
    },
    serveKind: o.serve?.kind,
    testIdAttribute: o.testIdAttribute ?? "data-testid",
  }
}

export const KEY = {
  options: "vitest-playwright:options",
  baseURL: "vitest-playwright:baseURL",
} as const

declare module "vitest" {
  interface ProvidedContext {
    "vitest-playwright:options": ResolvedOptions
    "vitest-playwright:baseURL": string | undefined
  }
}
