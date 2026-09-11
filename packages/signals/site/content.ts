// One row per page, nested the way the sidebar nests. `scripts/ship.mjs` reads the slugs back with
// a regular expression, so each stays `slug: "..."`.
import type { SiteContent, SiteGroup, SitePage } from "@hafley66/docs-kit"
import { pagesOf, routeOf as routeIn, targetOf as targetIn } from "@hafley66/docs-kit"

/** github.io serves the hub at `/hafley-rxjs/`, so this site takes a subdirectory under it. */
export const BASE = "/hafley-rxjs/signals/"

// The order of this array is the order of the sidebar.
export const GROUPS: readonly SiteGroup[] = [
  {
    text: "Start",
    pages: [
      { slug: "overview", title: "Overview", source: "pages/README.md" },
      { slug: "install", title: "Install", source: "pages/install.md" },
      { slug: "what-a-signal-is", title: "What a signal is", source: "pages/what-a-signal-is.md" },
    ],
  },
  {
    text: "The four forms",
    pages: [
      { slug: "forms", title: "The constructor takes four things", source: "pages/forms.md" },
      { slug: "form-state", title: "State", source: "pages/form-state.md" },
      { slug: "form-source", title: "Source", source: "pages/form-source.md" },
      { slug: "form-computed", title: "Computed", source: "pages/form-computed.md" },
      { slug: "form-event", title: "Event", source: "pages/form-event.md" },
    ],
  },
  {
    text: "Composing",
    pages: [
      { slug: "paths", title: "A path is a signal", source: "pages/paths.md" },
      { slug: "pipe", title: "pipe$", source: "pages/pipe.md" },
      { slug: "signal-map", title: "signalMap", source: "pages/signal-map.md" },
    ],
  },
  {
    text: "External state",
    pages: [
      { slug: "storage", title: "Storage signals", source: "pages/storage.md" },
      { slug: "route", title: "Route signals", source: "pages/route.md" },
      { slug: "slice", title: "createSlice and epics", source: "pages/slice.md" },
    ],
  },
  {
    text: "Reference",
    pages: [{ slug: "reference-api", title: "Every export", source: "pages/reference-api.md" }],
  },
]

export const RECEIPTS: SiteGroup = {
  text: "Receipts",
  pages: [{ slug: "stats", title: "Size and memory", source: "stats.md" }],
}

export const HOME = "overview"

export const CONTENT: SiteContent = { base: BASE, groups: GROUPS, receipts: RECEIPTS, home: HOME }

export const PAGES: readonly SitePage[] = pagesOf(CONTENT)

/** The route a page is served at, relative to `BASE`. */
export const routeOf = (page: SitePage): string => routeIn(CONTENT, page)

/** The file VitePress writes for a page, relative to `site/`. */
export const targetOf = (page: SitePage): string => targetIn(CONTENT, page)
