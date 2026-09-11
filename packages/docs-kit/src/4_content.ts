// One row per page, nested the way the sidebar nests. A site declares the arrays; the config
// factory derives the sidebar, the route rewrites, and the page allow-list from them.

export interface SitePage {
  readonly slug: string
  readonly title: string
  /** Relative to the site directory. A `pages/` source is a document copied in by the content step. */
  readonly source: string
}

export interface SiteGroup {
  readonly text: string
  readonly pages: readonly SitePage[]
}

export interface SiteContent {
  /** github.io serves the hub at `/hafley-rxjs/`, so each site takes a subdirectory under it. */
  readonly base: string
  readonly groups: readonly SiteGroup[]
  /** Reached from the receipts strip at the foot of every page rather than from the concept tree. */
  readonly receipts: SiteGroup
  /** The slug served at the site root. */
  readonly home: string
}

export const pagesOf = (content: SiteContent): readonly SitePage[] =>
  [...content.groups, content.receipts].flatMap((it) => it.pages)

/** The route a page is served at, relative to the site base. */
export const routeOf = (content: SiteContent, page: SitePage): string =>
  page.slug === content.home ? "/" : `/${page.slug}`

/** The file VitePress writes for a page, relative to the site directory. */
export const targetOf = (content: SiteContent, page: SitePage): string =>
  page.slug === content.home ? "index.md" : `${page.slug}.md`
