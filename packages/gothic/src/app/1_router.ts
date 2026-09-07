import type { Mode } from "@hafley66/report-shell"
import { Signal } from "@hafley66/signals"
import { transition } from "./3_view.js"

export type Loc = { path: string; search: string }
export const HOME = "/eye"

// file:// has no server to rewrite paths, so the single-file build routes in the hash
export const hashMode = (): boolean => typeof location !== "undefined" && location.protocol === "file:"

const normalise = (path: string): string => {
  const p = path.startsWith("/") ? path : `/${path}`
  return p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p
}

export function parseHref(href: string, hash: boolean, fallback = HOME): Loc {
  const cut = href.indexOf("#")
  const target = hash
    ? cut < 0
      ? ""
      : href.slice(cut + 1)
    : (cut < 0 ? href : href.slice(0, cut)).replace(/^\w+:\/\/[^/]*/, "")
  const q = target.indexOf("?")
  const path = normalise(q < 0 ? target : target.slice(0, q))
  return { path: path === "/" ? fallback : path, search: q < 0 ? "" : target.slice(q) }
}

export const toHref = (l: Loc, hash: boolean): string => (hash ? `#${l.path}${l.search}` : `${l.path}${l.search}`)

const readLoc = (): Loc => parseHref(location.href, hashMode())

export const loc: Signal<Loc> = Signal<Loc>(typeof location === "undefined" ? { path: HOME, search: "" } : readLoc())

// file:// origins refuse history writes; the hash carries the same url there
function write(url: string, mode: Mode): void {
  try {
    history[mode === "push" ? "pushState" : "replaceState"](null, "", url)
  } catch {
    if (mode === "push") location.hash = url.replace(/^#/, "")
    else location.replace(url)
  }
}

export function navigate(path: string, search = "", mode: Mode = "push"): void {
  const next: Loc = { path, search }
  if (next.path === loc.$().path && next.search === loc.$().search) return
  transition(() => {
    write(toHref(next, hashMode()), mode)
    loc.$(next)
  })
}

export function writeSearch(search: string, mode: Mode): void {
  const cur = loc.$()
  if (cur.search === search) return
  const next: Loc = { path: cur.path, search }
  write(toHref(next, hashMode()), mode)
  loc.$(next)
}

export function listen(): () => void {
  const sync = () => loc.$(readLoc())
  addEventListener("popstate", sync)
  addEventListener("hashchange", sync)
  return () => {
    removeEventListener("popstate", sync)
    removeEventListener("hashchange", sync)
  }
}
