import { route } from "@hafley66/path"
import * as z from "zod"
import { type AnySpec, fieldSchema, parseValues } from "./0_spec.js"

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
