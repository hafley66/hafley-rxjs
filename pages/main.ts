// The shell's root document. Two jobs, in this order:
//
//   1. a gothic-looking hash at the root is a bookmark from before the shell existed, so replace
//      the location with `gothic/` plus that same hash and let gothic route it. index.html carries
//      an inline copy of this test injected at build time, which fires before this module is even
//      fetched; the call in `start()` covers a dev server hit and costs nothing when it misses.
//   2. no hash: render the hub.
import { enableTips } from "@hafley66/report-shell/tips"
import { Signal } from "@hafley66/signals"
import { SITES, baseForPathname, siteForHash } from "./manifest.ts"
import { renderStrip } from "./strip.ts"
import "@hafley66/report-shell/kit.css"
import "./shell.css"

function redirectFromHash(): boolean {
  const site = siteForHash(location.hash)
  if (site === undefined) return false
  location.replace(`${baseForPathname(location.pathname)}${site.slug}/${location.hash}`)
  return true
}

function card(slug: string, title: string, blurb: string, pkg: string, base: string): HTMLAnchorElement {
  const link = document.createElement("a")
  link.className = "hub-card"
  link.href = `${base}${slug}/`
  link.dataset.card = slug
  const heading = document.createElement("b")
  heading.className = "hub-card-title"
  heading.textContent = title
  const line = document.createElement("span")
  line.className = "hub-card-blurb"
  line.textContent = blurb
  const meta = document.createElement("span")
  meta.className = "hub-card-meta"
  meta.textContent = `${pkg}  ${base}${slug}/`
  link.append(heading, line, meta)
  return link
}

function start(): void {
  if (redirectFromHash()) return
  // The inline script only sees the hash the document loaded with. A hash typed into the address
  // bar, or a link followed from inside the hub, arrives as a hashchange on the same document.
  addEventListener("hashchange", () => void redirectFromHash())
  const base = baseForPathname(location.pathname)
  const strip = document.querySelector("[data-pages-strip]")
  if (strip instanceof HTMLElement) renderStrip(strip, location.pathname)

  const host = document.querySelector("[data-hub-cards]")
  const filterInput = document.querySelector(".hub-filter")
  if (!(host instanceof HTMLElement)) return

  const filter = Signal("")
  filter.$.subscribe(term => {
    const needle = term.trim().toLowerCase()
    const shown = SITES.filter(it => needle === "" || `${it.slug} ${it.title} ${it.blurb} ${it.pkg}`.toLowerCase().includes(needle))
    if (shown.length === 0) {
      const empty = document.createElement("p")
      empty.className = "hub-empty"
      empty.textContent = `no package matches "${needle}"`
      host.replaceChildren(empty)
      return
    }
    host.replaceChildren(...shown.map(it => card(it.slug, it.title, it.blurb, it.pkg, base)))
  })

  if (filterInput instanceof HTMLInputElement) {
    filterInput.addEventListener("input", () => filter.$(filterInput.value))
  }
  enableTips()
}

start()
