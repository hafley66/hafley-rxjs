// One row per page, nested the way the sidebar nests. `site/.vitepress/config.ts` derives the
// sidebar, the route rewrites, and the page allow-list from these arrays.
// `scripts/ship.mjs` reads the slugs back with a regular expression, so each stays `slug: "..."`.

// The six concept groups are the six axes of `FEATURE_AXES` in `src/features.ts`, so a new feature
// id has exactly one group to land in.

/** github.io serves gothic at `/hafley-rxjs/`, so this site takes a subdirectory under it. */
export const BASE = "/hafley-rxjs/signal-grid/"

export interface SitePage {
  readonly slug: string
  readonly title: string
  /** Relative to `site/`. A `pages/` source is a document copied in by `pnpm site:content`. */
  readonly source: string
}

export interface SiteGroup {
  readonly text: string
  readonly pages: readonly SitePage[]
}

// The order of this array is the order of the sidebar.
export const GROUPS: readonly SiteGroup[] = [
  {
    text: "Start",
    pages: [
      { slug: "overview", title: "Overview", source: "pages/README.md" },
      { slug: "install", title: "Install", source: "pages/install.md" },
      { slug: "first-grid", title: "Your first grid", source: "pages/first-grid.md" },
      { slug: "five-laws", title: "The five laws", source: "pages/five-laws.md" },
      { slug: "reading-this-site", title: "Reading this site", source: "pages/reading-this-site.md" },
    ],
  },
  {
    text: "Rows",
    pages: [
      { slug: "rows-sort", title: "Sort", source: "pages/rows-sort.md" },
      { slug: "rows-group", title: "Group", source: "pages/rows-group.md" },
      { slug: "rows-tree", title: "Tree data", source: "pages/rows-tree.md" },
      { slug: "rows-detail", title: "Detail rows", source: "pages/rows-detail.md" },
      { slug: "rows-select", title: "Select", source: "pages/rows-select.md" },
      { slug: "rows-pin", title: "Pin", source: "pages/rows-pin.md" },
      { slug: "rows-reorder", title: "Reorder", source: "pages/rows-reorder.md" },
      { slug: "rows-height", title: "Height", source: "pages/rows-height.md" },
    ],
  },
  {
    text: "Columns",
    pages: [
      { slug: "columns-visibility", title: "Visibility", source: "pages/columns-visibility.md" },
      { slug: "columns-order", title: "Order", source: "pages/columns-order.md" },
      { slug: "columns-pin", title: "Pin", source: "pages/columns-pin.md" },
      { slug: "columns-width", title: "Resize and width", source: "pages/columns-width.md" },
      { slug: "columns-header-groups", title: "Header groups", source: "pages/columns-header-groups.md" },
    ],
  },
  {
    text: "Cells",
    pages: [
      { slug: "cells-slots", title: "Slots", source: "pages/cells-slots.md" },
      { slug: "cells-signal-slots", title: "Slots that are signals", source: "pages/cells-signal-slots.md" },
      { slug: "cells-span", title: "Span", source: "pages/cells-span.md" },
      { slug: "cells-range", title: "Range selection and focus", source: "pages/cells-range.md" },
    ],
  },
  {
    text: "Loading rows",
    pages: [
      { slug: "page-paginate", title: "Pagination", source: "pages/page-paginate.md" },
      { slug: "page-infinite", title: "Infinite scroll", source: "pages/page-infinite.md" },
      { slug: "page-server", title: "Server mode", source: "pages/page-server.md" },
      { slug: "page-observable", title: "Rows from an Observable", source: "pages/page-observable.md" },
    ],
  },
  {
    text: "View",
    pages: [
      { slug: "view-virtualize", title: "Virtualization", source: "pages/view-virtualize.md" },
      { slug: "view-scroll", title: "Scroll position as state", source: "pages/view-scroll.md" },
      { slug: "view-density", title: "Density", source: "pages/view-density.md" },
      { slug: "view-list", title: "List view and the transpose", source: "pages/view-list.md" },
      { slug: "view-theme", title: "Theming", source: "pages/view-theme.md" },
    ],
  },
  {
    text: "Reference",
    pages: [
      { slug: "reference-grid", title: "grid()", source: "pages/reference-grid.md" },
      { slug: "reference-column-def", title: "ColumnDef", source: "pages/reference-column-def.md" },
      { slug: "reference-grid-state", title: "GridState", source: "pages/reference-grid-state.md" },
      { slug: "reference-actions", title: "Intents, changes, effects", source: "pages/reference-actions.md" },
      { slug: "reference-epics", title: "Epics", source: "pages/reference-epics.md" },
      { slug: "reference-slots", title: "Slots", source: "pages/reference-slots.md" },
      { slug: "reference-menus", title: "Context menus", source: "pages/reference-menus.md" },
      { slug: "parity", title: "Feature parity", source: "pages/1_parity.md" },
      { slug: "competitors", title: "Competitors", source: "pages/3_competitors.md" },
    ],
  },
  {
    text: "Why it is built this way",
    pages: [
      { slug: "why-forests", title: "Two ordered forests", source: "pages/why-forests.md" },
      { slug: "why-seats", title: "The seat table", source: "pages/why-seats.md" },
      { slug: "why-no-solver", title: "No layout algorithm", source: "pages/why-no-solver.md" },
      { slug: "why-signals", title: "Signals instead of value and onChange", source: "pages/why-signals.md" },
      { slug: "why-alternatives", title: "Alternatives rejected", source: "pages/why-alternatives.md" },
    ],
  },
  {
    text: "Showcase",
    pages: [
      { slug: "showcase-everything", title: "Everything table", source: "pages/showcase-everything.md" },
      { slug: "showcase-tree", title: "Filesystem tree", source: "pages/showcase-tree.md" },
      { slug: "showcase-matrix", title: "Matrix", source: "pages/showcase-matrix.md" },
      { slug: "showcase-detail", title: "Master detail", source: "pages/showcase-detail.md" },
      { slug: "showcase-sheet", title: "Million-row sheet", source: "pages/showcase-sheet.md" },
    ],
  },
]

// Reached from the receipts strip at the foot of every page rather than from the concept tree,
// because none of the four answers a question about using the library.
export const RECEIPTS: SiteGroup = {
  text: "Receipts",
  pages: [
    { slug: "stats", title: "Size and memory", source: "stats.md" },
    { slug: "benchmarks", title: "Benchmarks", source: "benchmarks.md" },
    { slug: "proof", title: "Filmed proof", source: "pages/4_proof.md" },
    { slug: "receipts-method", title: "How these numbers are produced", source: "pages/8_receipts.md" },
  ],
}

export const PAGES: readonly SitePage[] = [...GROUPS, RECEIPTS].flatMap((it) => it.pages)

export const HOME = "overview"

/** The route a page is served at, relative to `BASE`. */
export const routeOf = (page: SitePage): string => (page.slug === HOME ? "/" : `/${page.slug}`)

/** The file VitePress writes for a page, relative to `site/`. */
export const targetOf = (page: SitePage): string => (page.slug === HOME ? "index.md" : `${page.slug}.md`)
