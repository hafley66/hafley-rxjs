// One entry per package that ships a site. Adding a package to GitHub Pages is adding an object to
// SITES: the shell, the strip, and scripts/pages.mjs all read this file and nothing else.

/** The pathname prefix GitHub Pages serves the repository under. */
export const REPO_BASE = "/hafley-rxjs/"

export interface PageSite {
  /** The subdirectory on the branch, and the tab id. */
  readonly slug: string
  readonly title: string
  /** One line, what it is. */
  readonly blurb: string
  /** The workspace package name. */
  readonly pkg: string
  /** The command that produces its site, run from the repository root. */
  readonly build: string
  /** Path, relative to the repository root, of the directory to copy. */
  readonly dist: string
  /**
   * Hash paths this site owns. The shell's root document reads `location.hash` and replaces the
   * location with `<slug>/` plus the same hash when it matches one of these, so a bookmark of
   * `https://hafley66.github.io/hafley-rxjs/#/icons` keeps landing on the same view.
   */
  readonly hashRoutes?: readonly string[]
}

export const SITES: readonly PageSite[] = [
  {
    slug: "gothic",
    title: "gothic",
    blurb: "Procedural SVG notebooks: spec-derived bars, URL state per section, shuffle, draw-in.",
    pkg: "@hafley66/gothic",
    build: "pnpm --filter @hafley66/gothic build:single",
    dist: "packages/gothic/dist",
    // packages/gothic/src/pages/*.ts, the `path:` of every PAGE. gothic runs `hashMode()` in its
    // single-file build, so every one of these reaches the browser as `#/<name>`.
    hashRoutes: [
      "/arches",
      "/architecture",
      "/astrolabe",
      "/border",
      "/circles",
      "/eye",
      "/fma",
      "/fractal",
      "/frames",
      "/guilloche",
      "/icons",
      "/slice",
      "/tiles",
      "/vello",
    ],
  },
  {
    slug: "signal-grid",
    title: "signal-grid",
    blurb: "Relational data grid kernel: two ordered forests, five pure operators, RxJS intents, signal derivation.",
    pkg: "@hafley66/signal-grid",
    build: "pnpm --filter @hafley66/signal-grid ship",
    dist: "packages/signal-grid/site/dist",
  },
  {
    slug: "signals",
    title: "signals",
    blurb: "RxJS-native reactive signals: one constructor, four forms, proxy-based nested access, no value and onChange pair.",
    pkg: "@hafley66/signals",
    build: "pnpm --filter @hafley66/signals ship",
    dist: "packages/signals/site/dist",
  },
]

/** The site that owns a hash path, or undefined when the root should render the hub. */
export function siteForHash(hash: string): PageSite | undefined {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash
  const query = raw.indexOf("?")
  const path = query < 0 ? raw : raw.slice(0, query)
  const trimmed = path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path
  if (trimmed.length < 2) return undefined
  return SITES.find(it => (it.hashRoutes ?? []).some(route => trimmed === route || trimmed.startsWith(`${route}/`)))
}

/**
 * The slug the current pathname is inside, or undefined at the hub. Prefix-agnostic on purpose: the
 * same build has to answer under `/hafley-rxjs/` on Pages and under any prefix a local preview picks.
 */
export function slugForPathname(pathname: string): string | undefined {
  const segments = pathname.split("/").filter(it => it.length > 0)
  return SITES.find(site => segments.includes(site.slug))?.slug
}

/** The prefix the shell is served under, read back out of a pathname that sits inside a site. */
export function baseForPathname(pathname: string): string {
  const slug = slugForPathname(pathname)
  if (slug !== undefined) {
    const marker = `/${slug}/`
    const at = pathname.indexOf(marker)
    if (at >= 0) return pathname.slice(0, at + 1)
  }
  return pathname.endsWith("/") ? pathname : pathname.replace(/[^/]*$/, "")
}
