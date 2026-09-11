// The shell. Five routes over one set of boxes, each route a module that mounts a grid and hands
// back the teardown, so switching route stops the previous grid before the next one is built.
import { Route, Signal } from "@hafley66/signals"
import { filter, map, tap } from "rxjs"
import { mountInView, runWhenInView } from "@hafley66/docs-kit"
import { grid, render } from "../src/index.js"
import "../src/theme.css"
import "./demo.css"
import { h, must } from "./controls.js"
import { everythingDemo } from "./1_everything.js"
import { treeDemo } from "./2_tree.js"
import { matrixDemo } from "./3_matrix.js"
import { detailDemo } from "./4_detail.js"
import { sheetDemo } from "./5_sheet.js"
import type { DemoHandle, DemoHosts, DemoRoute } from "./0_shell.js"

const ROUTES: readonly DemoRoute[] = [everythingDemo, treeDemo, matrixDemo, detailDemo, sheetDemo]

const shell = must("#demo")
const panel = must("#panel")
const stage = must("#stage")
const readoutHost = must("#readout")
const nav = must("#nav")
const title = must("#route-title")
const blurb = must("#route-blurb")

const hosts: DemoHosts = { shell, panel, stage, readout: readoutHost }

// --- Theme ------------------------------------------------------------------

interface Theme {
  readonly name: string
  readonly label: string
  readonly vars: Readonly<Record<string, string>>
}

const THEMES: readonly Theme[] = [
  {
    name: "light",
    label: "Light",
    vars: {
      "--demo-scheme": "light",
      "--demo-bg": "#ffffff", "--demo-fg": "#16181d", "--demo-line": "#e2e6ec",
      "--demo-head-bg": "#f4f6fa", "--demo-hover-bg": "#eef3fb", "--demo-selected-bg": "#dbe9ff",
      "--demo-accent": "#1f5fd0", "--demo-shell-bg": "#e9edf3", "--demo-panel-bg": "#ffffff",
      "--demo-muted": "#59616f",
    },
  },
  {
    name: "dark",
    label: "Dark",
    vars: {
      "--demo-scheme": "dark",
      "--demo-bg": "#14161a", "--demo-fg": "#e6e8ea", "--demo-line": "#2a2f36",
      "--demo-head-bg": "#1b1e23", "--demo-hover-bg": "#1f242b", "--demo-selected-bg": "#1d2b3d",
      "--demo-accent": "#6ea8fe", "--demo-shell-bg": "#0c0e11", "--demo-panel-bg": "#14171c",
      "--demo-muted": "#98a1af",
    },
  },
  {
    name: "ember",
    label: "Ember",
    vars: {
      "--demo-scheme": "dark",
      "--demo-bg": "#1b1512", "--demo-fg": "#f5e9df", "--demo-line": "#3b2c24",
      "--demo-head-bg": "#241b16", "--demo-hover-bg": "#2c211a", "--demo-selected-bg": "#4a2f1d",
      "--demo-accent": "#ff9147", "--demo-shell-bg": "#120d0b", "--demo-panel-bg": "#1b1512",
      "--demo-muted": "#bda291",
    },
  },
]

const applyTheme = (name: string): void => {
  const theme = THEMES.find((it) => it.name === name) ?? THEMES[1] ?? THEMES[0]
  if (theme === undefined) return
  for (const [key, value] of Object.entries(theme.vars)) shell.style.setProperty(key, value)
  shell.setAttribute("data-theme", theme.name)
  for (const button of Array.from(themeBox.getElementsByClassName("segment"))) {
    button.setAttribute("aria-pressed", String(button.getAttribute("data-theme") === theme.name))
  }
}

const themeBox = must("#theme")
for (const theme of THEMES) {
  const button = h("button", "segment", theme.label)
  button.type = "button"
  button.setAttribute("data-theme", theme.name)
  button.addEventListener("click", () => applyTheme(theme.name))
  themeBox.append(button)
}

// --- Routing ----------------------------------------------------------------

const route = Route("/:demo")

const HOME = ROUTES[0]?.slug ?? "everything"

const slugOf = (): string => {
  const value = route.$()
  return value.matched ? String(value.demo) : HOME
}

const navLinks = new Map<string, HTMLAnchorElement>()

for (const entry of ROUTES) {
  const link = document.createElement("a")
  link.className = "nav-link"
  link.href = route.href({ demo: entry.slug })
  link.append(h("span", "nav-slug", `/${entry.slug}`), h("span", "nav-title", entry.title))
  navLinks.set(entry.slug, link)
  nav.append(link)
}

document.addEventListener("click", (event) => {
  if (event.defaultPrevented || event.button !== 0) return
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  const target = event.target
  if (!(target instanceof Element)) return
  const anchor = target.closest("a")
  if (!(anchor instanceof HTMLAnchorElement)) return
  if (anchor.origin !== location.origin) return
  const slug = anchor.pathname.replace(/^\/+|\/+$/g, "")
  if (slug === "" || slug === slugOf()) return
  event.preventDefault()
  route.navigate({ demo: slug })
})

// --- Mounting ---------------------------------------------------------------

let active: DemoHandle | null = null
let shown: string | null = null
let generation = 0

const markReady = (slug: string, started: number, token: number): void => {
  const tick = (): void => {
    if (token !== generation) return
    if (stage.getElementsByClassName("sg-row").length === 0) {
      requestAnimationFrame(tick)
      return
    }
    requestAnimationFrame(() => {
      if (token !== generation) return
      const root = document.documentElement
      root.setAttribute("data-first-row-ms", (performance.now() - started).toFixed(1))
      root.setAttribute("data-demo-slug", slug)
      root.setAttribute("data-demo", "ready")
    })
  }
  requestAnimationFrame(tick)
}

const missing = (slug: string): void => {
  const wrap = h("section", "missing")
  wrap.append(h("p", "missing-code", "404"))
  wrap.append(h("p", "missing-line", `No demo at /${slug}. ${ROUTES.length} exist:`))
  const list = h("ul", "missing-list")
  for (const entry of ROUTES) {
    const item = document.createElement("li")
    const link = document.createElement("a")
    link.href = route.href({ demo: entry.slug })
    link.textContent = `/${entry.slug} ${entry.title}`
    item.append(link)
    list.append(item)
  }
  wrap.append(list)
  stage.append(wrap)
  document.documentElement.setAttribute("data-demo", "missing")
}

function show(slug: string): void {
  generation += 1
  const token = generation
  const started = performance.now()
  document.documentElement.setAttribute("data-demo", "loading")
  active?.stop()
  active = null
  window.__grid = null
  window.__demo = {}
  panel.replaceChildren()
  stage.replaceChildren()
  readoutHost.replaceChildren()

  const entry = ROUTES.find((it) => it.slug === slug)
  for (const [key, link] of navLinks) {
    if (key === slug) link.setAttribute("aria-current", "page")
    else link.removeAttribute("aria-current")
  }
  if (entry === undefined) {
    title.textContent = "Not found"
    blurb.textContent = ""
    missing(slug)
    return
  }
  title.textContent = entry.title
  blurb.textContent = entry.blurb
  document.title = `${entry.title} | signal-grid demos`
  active = entry.mount(hosts)
  window.__grid = active.grid
  markReady(slug, started, token)
}

applyTheme("dark")
shell.style.setProperty("--demo-pad", "10px")
shell.style.setProperty("--demo-indent", "16px")

// The shell is the gate for the router too, so the one place a raw subscription would be left in
// this tree is the one place the rule would have to be argued for.
const routed$ = route.$.pipe(
  map(() => slugOf()),
  filter((it) => it !== shown),
  tap((it) => {
    shown = it
    show(it)
  }),
)

mountInView(shell, () => runWhenInView(routed$))

window.__sg = { grid, render, Signal }
window.__routes = ROUTES.map((it) => ({ slug: it.slug, title: it.title, features: it.features, defects: it.defects }))

declare global {
  interface Window {
    /** The three entry points, so a console session can build a fifth grid without a bundler. */
    __sg: { grid: typeof grid; render: typeof render; Signal: typeof Signal }
    __routes: readonly { slug: string; title: string; features: readonly string[]; defects: readonly string[] }[]
  }
}
