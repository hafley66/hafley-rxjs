// pkg:test: vitest:test.extend with $worker / $file / $test fixtures. context and page read the handles
// the pkg:aroundEach hook acquired; only browser, fileRoot and request acquire their own resources.

import type { Test } from "@vitest/runner"
import type { APIRequestContext, Browser, BrowserContext, BrowserContextOptions, Clock, Page } from "playwright"
import { merge } from "rxjs"
import { filter, map } from "rxjs/operators"
import { test as base, inject } from "vitest"
import { KEY, type ResolvedOptions } from "./0_options.js"
import { acquire, apiCall$, context$, type Handle, nodeFetch$, page$, request$ } from "./5_streams.js"
import { type FileRoot, fileRoot as makeFileRoot, type TestLog, taskRoots, workerRoot, workerState } from "./6_roots.js"
import { ensureBrowser, releaseLazyBrowser } from "./8_around.js"
import { logApi, logNet } from "./10_telemetry.js"

export interface PwWorker {
  options: ResolvedOptions
  baseURL: string | undefined
  browser: Browser
}
export interface PwFile {
  fileRoot: FileRoot | null
}
export interface PwTest {
  contextOptions: BrowserContextOptions
  context: BrowserContext
  page: Page
  request: APIRequestContext
  clock: Clock
  step: <T>(title: string, body: () => Promise<T>) => Promise<T>
  /** The attempt log signal: page errors, console lines, net events of both realms. */
  log: TestLog
}

function ready<T>(v: T | null, what: string): T {
  if (!v)
    throw new Error(
      `vitest-playwright: the ${what} is not ready; fixtures resolve after the aroundEach hook acquired it`,
    )
  return v
}
function rootOf(task: Test) {
  const r = taskRoots.get(task)
  if (!r)
    throw new Error(
      "vitest-playwright: no attempt root; is @hafley66/vitest-playwright/setup in setupFiles (the plugin adds it)?",
    )
  return r
}

export const test = base.extend<{ $worker: PwWorker; $file: PwFile; $test: PwTest }>({
  options: [
    // biome-ignore lint/correctness/noEmptyPattern: vitest requires object destructuring in a fixture's first parameter
    async ({}, use) => {
      await use(inject(KEY.options))
    },
    { scope: "worker" },
  ],
  baseURL: [
    async ({ options }, use) => {
      await use(inject(KEY.baseURL) ?? options.context.baseURL)
    },
    { scope: "worker" },
  ],
  browser: [
    async ({ options, baseURL }, use) => {
      workerState.root ??= workerRoot(options, baseURL)
      const browser = await ensureBrowser(options)
      // worker boundary: the one subscription for pw api calls and node-realm fetches outside any attempt (attempt-owned
      // fetches fold into that attempt's log in 8_around); both only emit to tel: sinks
      const taps = merge(
        options.log.api ? apiCall$().pipe(map(logApi)) : [],
        options.log.net
          ? nodeFetch$().pipe(
              filter(n => !n.owner),
              map(logNet),
            )
          : [],
      ).subscribe()
      try {
        await use(browser)
      } finally {
        taps.unsubscribe()
        await releaseLazyBrowser()
      }
    },
    { scope: "worker" },
  ],
  fileRoot: [
    async ({ browser, options, baseURL }, use) => {
      if (options.contextScope !== "file") {
        await use(null)
        return
      }
      const c = await acquire(
        context$(browser, options, { ...options.context, baseURL: baseURL ?? options.context.baseURL }),
      )
      let p: Handle<Page> | undefined
      try {
        p = await acquire(page$(c.value))
        await use(makeFileRoot(c.value, p.value))
      } finally {
        try {
          await p?.release()
        } finally {
          await c.release()
        }
      }
    },
    { scope: "file" },
  ],
  contextOptions: async ({ options }, use) => {
    await use(options.context)
  },
  context: async ({ task }, use) => {
    await use(ready(rootOf(task).root.context.$(), "context"))
  },
  page: async ({ task }, use) => {
    await use(ready(rootOf(task).root.page.$(), "page"))
  },
  log: async ({ task }, use) => {
    await use(rootOf(task).log)
  },
  clock: async ({ context }, use) => {
    await use(context.clock)
  },
  request: async ({ options, baseURL }, use) => {
    const h = await acquire(request$(options, baseURL))
    try {
      await use(h.value)
    } finally {
      await h.release()
    }
  },
  step: async ({ task }: { task: Test }, use: (v: PwTest["step"]) => Promise<void>) => {
    await use(async <T>(title: string, body: () => Promise<T>): Promise<T> => {
      const t0 = performance.now()
      try {
        return await body()
      } finally {
        if (rootOf(task).root.phase.$() === "run")
          await task.context.annotate(`${title} ${Math.round(performance.now() - t0)}ms`, "step").catch(() => {})
      }
    })
  },
})
export const it = test
export { describe, expect } from "vitest"
