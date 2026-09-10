// The zeroth tab row, as a standalone script a package site drops in with one <script> tag.
//
//   <script src="/hafley-rxjs/strip.js" defer></script>
//
// It is built to an IIFE with the manifest inlined, so the file a package site loads has no import
// to resolve and no stylesheet to pair with it. Styling reads the report-shell kit tokens when the
// host page has kit.css, and falls back to literals when it does not.
import { SITES, baseForPathname, slugForPathname } from "./manifest.ts"

const HOST_ATTRIBUTE = "data-pages-strip"

const CSS = `
.pages-strip {
  display: flex; flex-wrap: wrap; align-items: center; column-gap: 12px; row-gap: 2px;
  padding: 6px 14px; font: 13px/1.4 ui-monospace, Menlo, monospace;
  background: var(--panel-bg, light-dark(#fff, #161616));
  color: var(--muted, light-dark(#4a4a4a, #9aa0ad));
  border-bottom: 1px solid var(--line, light-dark(#ddd, #2a2a2a));
}
.pages-strip a { border-bottom: 2px solid transparent; padding: 1px 0; text-decoration: none; color: inherit }
.pages-strip a:hover { color: var(--fg, light-dark(#1a1a1a, #ddd)) }
.pages-strip a[aria-current] { border-color: var(--accent, #6fd7ad); color: var(--accent, #6fd7ad) }
.pages-strip-mark { opacity: .55; letter-spacing: .04em; text-transform: uppercase; font-size: 10px; margin-right: 2px }
`

function ensureStyle(doc: Document): void {
  if (doc.getElementById("pages-strip-css")) return
  const style = doc.createElement("style")
  style.id = "pages-strip-css"
  style.textContent = CSS
  doc.head.append(style)
}

function findHost(doc: Document): HTMLElement {
  const declared = doc.querySelector(`[${HOST_ATTRIBUTE}]`)
  if (declared instanceof HTMLElement) return declared
  const created = doc.createElement("div")
  created.setAttribute(HOST_ATTRIBUTE, "")
  doc.body.prepend(created)
  return created
}

/**
 * Renders the strip into `host`. Static flow, never sticky: gothic's own `.kit-top` is
 * `position: sticky; top: 0`, and a second sticky bar at the same offset would sit on top of it.
 */
export function renderStrip(host: HTMLElement, pathname: string): void {
  const doc = host.ownerDocument
  const base = baseForPathname(pathname)
  const current = slugForPathname(pathname)
  const nav = doc.createElement("nav")
  // Deliberately not `kit-files`: gothic's own tab row carries that class, and a host page's
  // selectors (and its tests) would otherwise match this strip too.
  nav.className = "pages-strip"
  nav.setAttribute("aria-label", "packages")

  const mark = doc.createElement("span")
  mark.className = "pages-strip-mark"
  mark.textContent = "hafley-rxjs"
  nav.append(mark)

  const hub = doc.createElement("a")
  hub.href = base
  hub.dataset.tab = "hub"
  hub.textContent = "hub"
  if (current === undefined) hub.setAttribute("aria-current", "page")
  nav.append(hub)

  for (const site of SITES) {
    const link = doc.createElement("a")
    link.href = `${base}${site.slug}/`
    link.dataset.tab = site.slug
    link.title = site.blurb
    link.textContent = site.title
    if (site.slug === current) link.setAttribute("aria-current", "page")
    nav.append(link)
  }

  host.replaceChildren(nav)
  host.setAttribute(HOST_ATTRIBUTE, current ?? "hub")
  const height = nav.getBoundingClientRect().height
  if (height > 0) doc.documentElement.style.setProperty("--pages-strip-h", `${Math.round(height)}px`)
}

function boot(): void {
  if (typeof document === "undefined") return
  ensureStyle(document)
  renderStrip(findHost(document), location.pathname)
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true })
else boot()
