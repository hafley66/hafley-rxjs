// One row per page; `site/.vitepress/config.ts` derives the sidebar and the route rewrites from it.
// `scripts/ship.mjs` reads the slugs back with a regular expression, so each stays `slug: "..."`.

/** github.io serves gothic at `/hafley-rxjs/`, so this site takes a subdirectory under it. */
export const BASE = "/hafley-rxjs/signal-grid/"

export interface SitePage {
  readonly slug: string
  readonly title: string
  /** Relative to `site/`. `pages/`, `benchmarks.md`, and `demo-guide.md` are copied in by `pnpm site:content`. */
  readonly source: string
}

// The order of this array is the order of the sidebar.
export const PAGES: readonly SitePage[] = [
  { slug: "overview", title: "Overview", source: "pages/README.md" },
  { slug: "guide", title: "Guide", source: "pages/2_guide.md" },
  { slug: "api", title: "API", source: "pages/0_api.md" },
  { slug: "parity", title: "Parity", source: "pages/1_parity.md" },
  { slug: "competitors", title: "Competitors", source: "pages/3_competitors.md" },
  { slug: "proof", title: "Proof", source: "pages/4_proof.md" },
  { slug: "benchmarks", title: "Benchmarks", source: "benchmarks.md" },
  // `demo/` is the built demo app inside the same tree, so the doc page cannot take that slug.
  { slug: "demo-guide", title: "Demo", source: "demo-guide.md" },
  { slug: "stats", title: "Receipts", source: "stats.md" },
]

export const HOME = "overview"

/** The route a page is served at, relative to `BASE`. */
export const routeOf = (page: SitePage): string => (page.slug === HOME ? "/" : `/${page.slug}`)

/** The file VitePress writes for a page, relative to `site/`. */
export const targetOf = (page: SitePage): string => (page.slug === HOME ? "index.md" : `${page.slug}.md`)
