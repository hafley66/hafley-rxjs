// One row per page, nested the way the sidebar nests. `@hafley66/docs-kit` derives the sidebar, the
// route rewrites, and the page allow-list from these arrays.
// `scripts/ship.mjs` reads the slugs back with a regular expression, so each stays `slug: "..."`.
import type { SiteContent, SiteGroup } from "@hafley66/docs-kit"

/** github.io serves the hub at `/hafley-rxjs/`, so this site takes a subdirectory under it. */
export const BASE = "/hafley-rxjs/grapht/"

// The order of this array is the order of the sidebar.
export const GROUPS: readonly SiteGroup[] = [
  {
    text: "Start",
    pages: [
      { slug: "overview", title: "Overview", source: "pages/overview.md" },
      { slug: "model", title: "The canonical model", source: "pages/model.md" },
      { slug: "frame", title: "Frame and camera", source: "pages/frame.md" },
    ],
  },
  {
    text: "Rendering",
    pages: [
      { slug: "sticky", title: "Sticky layers", source: "pages/sticky.md" },
      { slug: "renderers", title: "Renderers", source: "pages/renderers.md" },
    ],
  },
  {
    text: "History",
    pages: [{ slug: "history", title: "The offline journal", source: "pages/history.md" }],
  },
  {
    text: "Reference",
    pages: [
      { slug: "reference-api", title: "Every export", source: "pages/reference-api.md" },
      { slug: "documentation", title: "Documentation and evidence", source: "pages/documentation.md" },
    ],
  },
  {
    text: "Proposed work",
    pages: [
      { slug: "roadmap", title: "Feature status", source: "pages/roadmap.md" },
      { slug: "plan-source-order", title: "Source ordering", source: "pages/plan-source-order.md" },
      { slug: "plan-graph-identity", title: "Identity and placements", source: "pages/plan-graph-identity.md" },
      { slug: "plan-neighbor-highlighting", title: "Neighbor highlighting", source: "pages/plan-neighbor-highlighting.md" },
      { slug: "plan-hop-gradient", title: "Hop gradient", source: "pages/plan-hop-gradient.md" },
      { slug: "plan-dom-groups-and-collapse", title: "DOM groups and collapse", source: "pages/plan-dom-groups-and-collapse.md" },
      { slug: "plan-optional-movement-journal", title: "Optional undo and persistence", source: "pages/plan-optional-movement-journal.md" },
    ],
  },
  {
    text: "Demos",
    pages: [{ slug: "proof", title: "Interactive proof", source: "pages/proof.md" }],
  },
]

// Empty on purpose: grapht ships no receipts strip until its measure step produces numbers a page
// could cite. `stats.json` still feeds the footer's build stamp.
export const RECEIPTS: SiteGroup = {
  text: "Receipts",
  pages: [],
}

export const HOME = "overview"

export const CONTENT: SiteContent = { base: BASE, groups: GROUPS, receipts: RECEIPTS, home: HOME }
