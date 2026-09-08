// pkg:$page / pkg:$context: globalThis proxies to the running attempt's pw:Page / pw:BrowserContext.
import type { BrowserContext, Page } from "playwright"
import { active, als, type AttemptStore } from "./6_roots.js"

/** Type anchor: importing this from index/setup keeps the `declare global` block in the emitted d.ts graph. */
export type PageGlobals = { $page: Page; $context: BrowserContext }

declare global {
  // eslint-disable-next-line no-var
  var $page: Page
  // eslint-disable-next-line no-var
  var $context: BrowserContext
}

const HOW = "It resolves inside a test body, beforeEach or afterEach of a file that imports @hafley66/vitest-playwright/setup (the plugin does this)."

/** The attempt store for the caller: its async context, else the single running attempt on this worker. */
export function store(key: string): AttemptStore {
  const s = als.getStore()
  if (s) {
    const phase = s.root.phase.$()
    if (phase === "run" || phase === "capture") return s
    throw new Error(`$${key}: the attempt "${s.root.task.name.$()}" is in phase ${phase}; a callback from a finished test reached the bridge.`)
  }
  if (active.size === 1) return active.values().next().value!
  if (active.size === 0) throw new Error(`$${key}: no running test. ${HOW}`)
  throw new Error(`$${key}: ${active.size} tests are running concurrently and this callback carries no test context (pw: event or route handler); use the \`page\` fixture inside it.`)
}
function current<K extends "page" | "context">(key: K) {
  const v = store(key).root[key].$()
  if (!v) throw new Error(`$${key}: the ${key} is not ready`)
  return v
}
type Of<K extends "page" | "context"> = K extends "page" ? Page : BrowserContext
function proxy<K extends "page" | "context">(key: K): Of<K> {
  return new Proxy({} as Of<K>, {
    get(_t, prop) {
      const target = current(key) as any
      const v = target[prop]
      return typeof v === "function" ? v.bind(target) : v
    },
    has(_t, prop) { return prop in (current(key) as any) },
  })
}
export function installPageGlobals(): void {
  if (!("$page" in globalThis)) Object.defineProperty(globalThis, "$page", { value: proxy("page"), configurable: true })
  if (!("$context" in globalThis)) Object.defineProperty(globalThis, "$context", { value: proxy("context"), configurable: true })
}
