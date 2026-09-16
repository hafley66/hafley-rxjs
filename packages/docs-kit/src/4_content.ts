// One row per page, nested the way the sidebar nests. A site declares the arrays; the config
// factory derives the sidebar, the route rewrites, and the page allow-list from them.
import { slash } from "@hafley66/path"

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

/**
 * The one segment a site's page route varies over. A site composes it with its base to get the URL
 * the browser lands on, so the sidebar, a link and a test resolve the same string by construction:
 * `slash(BASE).concatenate(PAGE_SEGMENT)`.
 */
export const PAGE_SEGMENT = slash(":page")

/** A page's route relative to the site base, printed by the template every site composes. */
const PAGE_PATH = slash("/").concatenate(PAGE_SEGMENT)

export const pagesOf = (content: SiteContent): readonly SitePage[] =>
  [...content.groups, content.receipts].flatMap((it) => it.pages)

/** The route a page is served at, relative to the site base. */
export const routeOf = (content: SiteContent, page: SitePage): string =>
  page.slug === content.home ? "/" : PAGE_PATH.print({ page: page.slug })

/** The file VitePress writes for a page, relative to the site directory. */
export const targetOf = (content: SiteContent, page: SitePage): string =>
  page.slug === content.home ? "index.md" : `${page.slug}.md`
