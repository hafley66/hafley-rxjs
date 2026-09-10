// The shell: nav, header, content pane, table of contents, search, and the route that picks a page.
// Routing is pathname-based, so every heading anchor stays free for `#section`.
import "../src/theme.css"
import "./site.css"
import { Route } from "@hafley66/signals"
import pkg from "../package.json"
import { HOME, PAGES, pageBySlug } from "./content.js"
import { EMBEDS, embedHost } from "./embeds.js"
import { renderMarkdown, type Heading } from "./md.js"
import { renderParityPage } from "./parity.js"
import { renderStatsPage, statsFooter } from "./stats.js"
import { search, type Hit } from "./search.js"

function must<T extends Element>(selector: string, kind: new () => T): T {
  const found = document.querySelector(selector)
  if (!(found instanceof kind)) throw new Error(`site/index.html is missing ${selector}`)
  return found
}

const nav = must(".nav", HTMLElement)
const content = must(".content", HTMLElement)
const tocPane = must(".toc", HTMLElement)
const findInput = must("#find-input", HTMLInputElement)
const findPanel = must("#find-results", HTMLElement)
const themeSelect = must("#theme", HTMLSelectElement)
const version = must("#version", HTMLElement)

version.textContent = `v${pkg.version}`
version.title = pkg.name

const el = (tag: string, className: string, text?: string): HTMLElement => {
  const node = document.createElement(tag)
  if (className !== "") node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

// --- Theme ------------------------------------------------------------------

const THEME_KEY = "signal-grid-site-theme"

const readTheme = (): string => {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    return stored === "light" || stored === "dark" ? stored : "auto"
  } catch {
    return "auto"
  }
}

const applyTheme = (value: string): void => {
  document.documentElement.style.colorScheme = value === "auto" ? "light dark" : value
  try {
    if (value === "auto") localStorage.removeItem(THEME_KEY)
    else localStorage.setItem(THEME_KEY, value)
  } catch {
    /* private mode keeps the choice for this document only */
  }
}

themeSelect.value = readTheme()
themeSelect.addEventListener("change", () => applyTheme(themeSelect.value))

// --- Routing ----------------------------------------------------------------

// The site is a project page under another one, so the pathname carries a prefix that is not part
// of any slug. `BASE_URL` is what the vite config's `base` compiled to, and it always ends in "/".
const BASE = import.meta.env.BASE_URL

const slugOf = (pathname: string): string => {
  const rest = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname.replace(/^\/+/, "")
  const slug = rest.replace(/^\/+|\/+$/g, "")
  return slug === "" || slug === "index.html" ? HOME : slug
}

const hrefFor = (slug: string): string => `${BASE}${slug}`

// `Route` is the change source here, not the matcher: it fires on popstate and on its own navigate
// event, and `slugOf` reads the location the base prefix has been taken off.
const route = Route("/:page")

const currentSlug = (): string => {
  route.$()
  return slugOf(location.pathname)
}

function go(slug: string, anchor?: string): void {
  pendingAnchor = anchor ?? null
  if (slug === currentSlug()) {
    scrollToAnchor()
    return
  }
  history.pushState(null, "", hrefFor(slug))
  dispatchEvent(new Event("instant:navigate"))
}

let pendingAnchor: string | null = null

function scrollToAnchor(): void {
  const anchor = pendingAnchor
  pendingAnchor = null
  if (anchor === null || anchor === "") {
    window.scrollTo({ top: 0 })
    return
  }
  const target = document.getElementById(anchor)
  if (target === null) {
    window.scrollTo({ top: 0 })
    return
  }
  target.scrollIntoView({ block: "start" })
}

// --- Nav --------------------------------------------------------------------

const navLinks = new Map<string, HTMLAnchorElement>()

function buildNav(): void {
  const list = el("ol", "nav-list")
  for (const page of PAGES) {
    const item = document.createElement("li")
    const link = document.createElement("a")
    link.href = hrefFor(page.slug)
    link.className = "nav-link"
    link.dataset.nav = ""
    link.append(el("span", "nav-order", String(page.order)), el("span", "nav-title", page.title))
    navLinks.set(page.slug, link)
    item.append(link)
    list.append(item)
  }
  nav.replaceChildren(el("h2", "nav-heading", "Pages"), list)
}

function markNav(slug: string): void {
  for (const [key, link] of navLinks) {
    if (key === slug) link.setAttribute("aria-current", "page")
    else link.removeAttribute("aria-current")
  }
}

// --- Table of contents ------------------------------------------------------

let tocObserver: IntersectionObserver | null = null

function buildToc(headings: readonly Heading[]): void {
  tocObserver?.disconnect()
  tocObserver = null
  const shown = headings.filter((heading) => heading.level >= 2 && heading.level <= 3)
  if (shown.length === 0) {
    tocPane.replaceChildren()
    tocPane.hidden = true
    return
  }
  tocPane.hidden = false
  const list = el("ul", "toc-list")
  const links = new Map<string, HTMLAnchorElement>()
  for (const heading of shown) {
    const item = document.createElement("li")
    item.dataset.level = String(heading.level)
    const link = document.createElement("a")
    link.href = `#${heading.id}`
    link.className = "toc-link"
    link.textContent = heading.text
    links.set(heading.id, link)
    item.append(link)
    list.append(item)
  }
  tocPane.replaceChildren(el("h2", "toc-heading", "On this page"), list)

  const seen = new Set<string>()
  tocObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) seen.add(entry.target.id)
        else seen.delete(entry.target.id)
      }
      let active: string | null = null
      for (const heading of shown) {
        if (seen.has(heading.id)) {
          active = heading.id
          break
        }
      }
      for (const [id, link] of links) {
        if (id === active) link.setAttribute("aria-current", "true")
        else link.removeAttribute("aria-current")
      }
    },
    { rootMargin: "-72px 0px -70% 0px" },
  )
  for (const heading of shown) {
    const target = document.getElementById(heading.id)
    if (target !== null) tocObserver.observe(target)
  }
}

// --- Pages ------------------------------------------------------------------

let teardown: (() => void) | null = null

function renderMissing(slug: string): void {
  const wrap = el("section", "missing")
  wrap.append(el("p", "missing-code", "404"))
  const title = el("h1", "", "No page at ")
  title.append(el("code", "", `/${slug}`))
  wrap.append(title)
  wrap.append(el("p", "", `This site has ${PAGES.length} pages. Every one of them:`))
  const list = el("ul", "missing-list")
  for (const page of PAGES) {
    const item = document.createElement("li")
    const link = document.createElement("a")
    link.href = hrefFor(page.slug)
    link.dataset.nav = ""
    link.textContent = page.title
    item.append(link)
    list.append(item)
  }
  wrap.append(list)
  content.replaceChildren(wrap)
  document.title = `Not found: /${slug} | signal-grid`
}

function show(slug: string): void {
  teardown?.()
  teardown = null
  const page = pageBySlug(slug)
  if (page === undefined) {
    markNav("")
    buildToc([])
    renderMissing(slug)
    scrollToAnchor()
    return
  }

  content.replaceChildren()
  let headings: readonly Heading[] = []

  if (page.view === "stats") {
    headings = renderStatsPage(content).headings
  } else if (page.view === "parity") {
    const mounted = renderParityPage(page.source, content)
    if (mounted === null) {
      // The generated tables did not parse. Rendering the markdown as written beats an empty page.
      const fallback = renderMarkdown(page.source)
      content.append(fallback.node)
      headings = fallback.headings
      console.warn("parity: no rows parsed from docs/1_parity.md, rendered as markdown")
    } else {
      headings = mounted.headings
      teardown = mounted.teardown
    }
  } else {
    const rendered = renderMarkdown(page.source)
    content.append(rendered.node)
    headings = rendered.headings
  }

  const embed = EMBEDS[slug]
  if (embed !== undefined) {
    try {
      const stop = embed(embedHost(content))
      if (typeof stop === "function") {
        const previous = teardown
        teardown = () => {
          stop()
          previous?.()
        }
      }
    } catch (error) {
      const failed = el("p", "embed-failed", `The live demo for this page failed to mount: ${String(error)}`)
      content.append(failed)
    }
  }

  markNav(slug)
  buildToc(headings)
  document.title = `${page.title} | signal-grid`
  scrollToAnchor()
}

// --- Search -----------------------------------------------------------------

let hits: readonly Hit[] = []
let cursor = -1

function closeFind(): void {
  findPanel.hidden = true
  findPanel.replaceChildren()
  findInput.setAttribute("aria-expanded", "false")
  hits = []
  cursor = -1
}

function markCursor(): void {
  const rows = findPanel.querySelectorAll(".find-hit")
  rows.forEach((row, index) => {
    if (index === cursor) row.setAttribute("aria-selected", "true")
    else row.removeAttribute("aria-selected")
  })
  const active = rows[cursor]
  if (active instanceof HTMLElement) active.scrollIntoView({ block: "nearest" })
}

function openHit(hit: Hit): void {
  closeFind()
  findInput.blur()
  go(hit.slug, hit.anchor)
}

function runFind(): void {
  const query = findInput.value
  hits = search(query)
  cursor = -1
  if (query.trim().length < 2) {
    closeFind()
    return
  }
  findPanel.hidden = false
  findInput.setAttribute("aria-expanded", "true")
  if (hits.length === 0) {
    findPanel.replaceChildren(el("p", "find-empty", `No page contains "${query.trim()}"`))
    return
  }
  const list = el("div", "find-list")
  hits.forEach((hit, index) => {
    const row = el("button", "find-hit")
    row.setAttribute("type", "button")
    row.setAttribute("role", "option")
    const trail = [hit.title, ...hit.path].join(" › ")
    row.append(el("span", "find-path", trail))
    const line = el("span", "find-line")
    line.append(document.createTextNode(hit.before), el("mark", "", hit.match), document.createTextNode(hit.after))
    row.append(line)
    row.addEventListener("click", () => openHit(hit))
    row.addEventListener("mouseenter", () => {
      cursor = index
      markCursor()
    })
    list.append(row)
  })
  findPanel.replaceChildren(el("p", "find-count", `${hits.length} matches`), list)
}

findInput.addEventListener("input", runFind)
findInput.addEventListener("focus", () => {
  if (findInput.value.trim().length >= 2) runFind()
})
findInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeFind()
    return
  }
  if (hits.length === 0) return
  if (event.key === "ArrowDown") {
    event.preventDefault()
    cursor = (cursor + 1) % hits.length
    markCursor()
    return
  }
  if (event.key === "ArrowUp") {
    event.preventDefault()
    cursor = cursor <= 0 ? hits.length - 1 : cursor - 1
    markCursor()
    return
  }
  if (event.key === "Enter") {
    event.preventDefault()
    const hit = hits[cursor === -1 ? 0 : cursor]
    if (hit !== undefined) openHit(hit)
  }
})

document.addEventListener("click", (event) => {
  const target = event.target
  if (target instanceof Node && !findPanel.contains(target) && target !== findInput) closeFind()
})

// The one global key: slash focuses search, the way every documentation site behaves.
document.addEventListener("keydown", (event) => {
  if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return
  const active = document.activeElement
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement) return
  event.preventDefault()
  findInput.focus()
  findInput.select()
})

// --- Link interception ------------------------------------------------------

document.addEventListener("click", (event) => {
  if (event.defaultPrevented || event.button !== 0) return
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  const target = event.target
  if (!(target instanceof Element)) return
  const anchor = target.closest("a")
  if (!(anchor instanceof HTMLAnchorElement)) return
  if (anchor.target === "_blank" || anchor.origin !== location.origin) return
  // `demo/` and `videos/` are real directories inside the same artifact, and the root above this
  // base belongs to another site, so anything that is not a declared page is left to the browser.
  if (!anchor.pathname.startsWith(BASE)) return
  const slug = slugOf(anchor.pathname)
  if (pageBySlug(slug) === undefined || slug === currentSlug()) return
  event.preventDefault()
  go(slug, anchor.hash.replace(/^#/, ""))
})

// --- Boot -------------------------------------------------------------------

buildNav()

// index.html ships a root-relative brand link, which is one segment short under a project base.
const brand = document.querySelector(".brand")
if (brand instanceof HTMLAnchorElement) brand.href = hrefFor(HOME)

document.body.append(statsFooter(hrefFor))

let shown: string | null = null
route.$.subscribe(() => {
  const slug = currentSlug()
  if (slug === shown) return
  shown = slug
  show(slug)
  // Focus follows the route so a keyboard user lands in the new page, but not on first paint,
  // where the browser has just given focus to the document already.
  if (document.readyState === "complete") content.focus({ preventScroll: true })
})
