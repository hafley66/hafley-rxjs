// Who am I, who started me, and what runtime am I in. Node answers from `process`. A browser has no
// pid, so the tab mints one; a worker has no storage at all and is handed one through its name.
import type { Ident, Runtime } from "./0_types.js"

const TAB_KEY = "hafley.trace.tab"
const WORKER_NAME = /^hafley:([^:]*):([^:]*)$/

type Proc = {
  pid?: number
  ppid?: number
  versions?: Record<string, string>
  env?: Record<string, string | undefined>
}

const proc = (): Proc | undefined =>
  (globalThis as { process?: Proc }).process

const uuid = (): string => {
  const c = globalThis.crypto
  if (c !== undefined && typeof c.randomUUID === "function") return c.randomUUID().slice(0, 8)
  return Math.random().toString(36).slice(2, 10)
}

export function runtimeOf(): Runtime {
  const g = globalThis as { Deno?: unknown; Bun?: unknown; document?: unknown; importScripts?: unknown }
  if (g.Deno !== undefined) return "deno"
  if (g.Bun !== undefined) return "bun"
  if (proc()?.versions?.["node"] !== undefined && g.document === undefined) return "nodejs"
  if (g.document !== undefined) return "browser"
  if (typeof g.importScripts === "function" || typeof (globalThis as { WorkerGlobalScope?: unknown }).WorkerGlobalScope !== "undefined") return "worker"
  return "unknown"
}

// `sessionStorage` is per tab and survives a reload, which is the pid-shaped lifetime a page has.
// `window.open` copies it into the new tab, so a document with an opener is reading its parent's id:
// mint a fresh one and keep the copied value as the parent. That is the ppid link, for free.
let tab: { pid: string; parent: string | undefined } | null = null

function tabIdent(): { pid: string; parent: string | undefined } {
  // Memoized per document. An inherited document mints once and then reads its own id back, and
  // without the memo the `inherited` test stays true and every call mints again.
  if (tab !== null) return tab
  const w = globalThis as unknown as { sessionStorage?: Storage; opener?: unknown; top?: unknown; self?: unknown }
  const store = w.sessionStorage
  if (store === undefined) {
    tab = { pid: uuid(), parent: undefined }
    return tab
  }
  const held = store.getItem(TAB_KEY) ?? undefined
  const inherited = w.opener != null || (w.top !== undefined && w.top !== w.self)
  if (held !== undefined && !inherited) {
    tab = { pid: held, parent: undefined }
    return tab
  }
  const pid = uuid()
  store.setItem(TAB_KEY, pid)
  tab = { pid, parent: held }
  return tab
}

/** Drop the memoized tab id. A test needs it; nothing else should. */
export function resetIdent(): void {
  tab = null
}

/**
 * The name a host gives a Worker is the only channel that reaches it before its first message, and
 * `self.name` reads it back. `workerName(parent, service)` prints it; `identOf` parses it.
 */
export function workerName(parentPid: string, service: string): string {
  return `hafley:${parentPid}:${service}`
}

function workerIdent(): { pid: string; parent: string | undefined; service: string | undefined } {
  const name = (globalThis as { name?: string }).name ?? ""
  const hit = WORKER_NAME.exec(name)
  if (hit === null) return { pid: uuid(), parent: undefined, service: name === "" ? undefined : name }
  return { pid: uuid(), parent: hit[1], service: hit[2] }
}

const bornOf = (): number => {
  const origin = globalThis.performance?.timeOrigin
  return typeof origin === "number" ? origin : Date.now()
}

/** Identity for this running thing. Every field can be overridden, because a test needs to. */
export function ident(over: Partial<Ident> = {}): Ident {
  const runtime = over.runtime ?? runtimeOf()
  const p = proc()
  const env = p?.env ?? {}
  let pid: string
  let parent: string | undefined
  let service: string | undefined
  if (runtime === "browser") {
    const tab = tabIdent()
    pid = tab.pid
    parent = tab.parent
  } else if (runtime === "worker") {
    const w = workerIdent()
    pid = w.pid
    parent = w.parent
    service = w.service
  } else {
    pid = String(p?.pid ?? uuid())
    parent = p?.ppid === undefined ? undefined : String(p.ppid)
  }
  const name =
    over.service ??
    env["OTEL_SERVICE_NAME"] ??
    service ??
    env["npm_package_name"] ??
    `unknown_service:${runtime}`
  // `in` rather than `??` on the optional fields: a caller passing `parent: undefined` means "no
  // parent", and `??` would fall through to the real one. A test needs to say that.
  const pick = <K extends keyof Ident>(key: K, fallback: Ident[K]): Ident[K] =>
    key in over ? (over[key] as Ident[K]) : fallback
  const resolved: Omit<Ident, "prefix"> = {
    service: name,
    namespace: pick("namespace", env["OTEL_SERVICE_NAMESPACE"]),
    instance: pick("instance", uuid()),
    pid: pick("pid", pid),
    parent: pick("parent", parent),
    runtime,
    version: pick("version", p?.versions?.["node"] ?? env["npm_package_version"]),
    born: pick("born", bornOf()),
  }
  return { ...resolved, prefix: over.prefix ?? `${resolved.service}/${runtime}:${resolved.pid}` }
}
