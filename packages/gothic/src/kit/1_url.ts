import { route } from "@hafley66/path"
import type { Signal } from "@hafley66/signals"
import { skip } from "rxjs"
import * as z from "zod"
import { type AnySpec, fieldSchema, parseValues, type ValuesOf } from "./0_spec.js"

export type Namespaces = Record<string, AnySpec>
export type NsValues = Record<string, Record<string, unknown>>
export type Mode = "replace" | "push"

const KEY = (ns: string, k: string) => `${ns}.${k}`

// one route per notebook: every "<section>.<key>" is an optional query field whose bad values drop to undefined
export function queryRoute(namespaces: Namespaces, path = "/") {
  const shape: Record<string, z.ZodType> = {}
  for (const [ns, spec] of Object.entries(namespaces))
    for (const [k, fd] of Object.entries(spec)) shape[KEY(ns, k)] = fieldSchema(fd).optional().catch(undefined)
  return route(path, z.object(shape), z.object({}))
}

export function parseSearch(search: string, namespaces: Namespaces): NsValues {
  const m = queryRoute(namespaces).match(`/${search.startsWith("?") ? search : `?${search}`}`)
  const flat: Record<string, unknown> = m.matched ? (m.values as Record<string, unknown>) : {}
  const out: NsValues = {}
  for (const [ns, spec] of Object.entries(namespaces)) {
    const raw: Record<string, unknown> = {}
    for (const k of Object.keys(spec)) raw[k] = flat[KEY(ns, k)]
    out[ns] = parseValues(spec, raw)
  }
  return out
}

// only non-default values print; returns "" or "?a.b=1&..."
export function printSearch(values: NsValues, namespaces: Namespaces): string {
  const flat: Record<string, unknown> = {}
  for (const [ns, spec] of Object.entries(namespaces))
    for (const [k, fd] of Object.entries(spec)) {
      const v = values[ns]?.[k]
      if (v !== undefined && v !== fd.default) flat[KEY(ns, k)] = v
    }
  const href = queryRoute(namespaces).href(flat as never)
  const i = href.indexOf("?")
  return i < 0 ? "" : href.slice(i)
}

// keys outside every registered namespace survive a write untouched
export function mergeSearch(current: string, next: string, namespaces: Namespaces): string {
  const keep = new URLSearchParams(current)
  const prefixes = Object.keys(namespaces).map(ns => `${ns}.`)
  for (const k of [...keep.keys()]) if (prefixes.some(p => k.startsWith(p))) keep.delete(k)
  const add = new URLSearchParams(next)
  for (const [k, v] of add) keep.set(k, v)
  const s = keep.toString()
  return s ? `?${s}` : ""
}

// several cells may share one namespace (values + pins); their specs merge per namespace for the URL
type Cell = { ns: string; spec: AnySpec; signal: Signal<Record<string, unknown>> }
const cells = new Map<string, Cell>()
let applying = false
let mode: Mode = "replace"
let listening = false

function specs(): Namespaces {
  const out: Namespaces = {}
  for (const c of cells.values()) out[c.ns] = { ...(out[c.ns] ?? {}), ...c.spec }
  return out
}
function current(): NsValues {
  const out: NsValues = {}
  for (const c of cells.values()) out[c.ns] = { ...(out[c.ns] ?? {}), ...c.signal.$() }
  return out
}

export function readUrl<S extends AnySpec>(ns: string, spec: S): ValuesOf<S> {
  return parseSearch(location.search, { [ns]: spec })[ns] as ValuesOf<S>
}

function write(m: Mode): void {
  const all = specs()
  const search = mergeSearch(location.search, printSearch(current(), all), all)
  const url = location.pathname + search + location.hash
  if (url === location.pathname + location.search + location.hash) return
  history[m === "push" ? "pushState" : "replaceState"](null, "", url)
}

function onPop(): void {
  const parsed = parseSearch(location.search, specs())
  applying = true
  try {
    for (const c of cells.values()) c.signal.$(Object.fromEntries(Object.keys(c.spec).map(k => [k, parsed[c.ns][k]])))
  } finally {
    applying = false
  }
}

// mode applies to the signal writes inside fn only; the default write is replaceState
export function commit(m: Mode, fn: () => void): void {
  mode = m
  try {
    fn()
  } finally {
    mode = "replace"
  }
}

export function bindUrl(ns: string, spec: AnySpec, signal: Signal<Record<string, unknown>>, cellKey = ns): () => void {
  cells.set(cellKey, { ns, spec, signal })
  if (!listening) {
    listening = true
    addEventListener("popstate", onPop)
  }
  const sub = signal.$.pipe(skip(1)).subscribe(() => {
    if (!applying) write(mode)
  })
  return () => {
    sub.unsubscribe()
    cells.delete(cellKey)
  }
}
