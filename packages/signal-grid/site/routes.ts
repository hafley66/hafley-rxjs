// The site's routes, spelled once. `@hafley66/path` prints and matches them, and it is pure, so
// node (this file, the vitepress config, the e2e suite in this package) and a browser page can all
// import it. The live form — `Route(template, { base })` from `@hafley66/signals` — reads a
// `location`, so it belongs in the page, and it reads the template this file exports.
import { PAGE_SEGMENT } from "@hafley66/docs-kit"
import { slash } from "@hafley66/path"
import { BASE } from "./content.js"

/** `BASE` is what vitepress prefixes every route with, so the template carries it and a match sees the URL. */
export const SITE_PATH = slash(BASE).concatenate(PAGE_SEGMENT)

/**
 * The URL a page is served at. Keys the template does not name become the query string, which is
 * the rule `Route.href` applies in the browser.
 */
export function pageUrl(page: string, query: Record<string, string | undefined> = {}): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) if (value !== undefined) search.set(key, value)
  const text = search.toString()
  const href = SITE_PATH.print({ page })
  return text === "" ? href : `${href}?${text}`
}

/** What a pathname is, as the template reads it: `matched` plus the params it bound. */
export function matchPage(pathname: string) {
  return SITE_PATH.match(pathname)
}