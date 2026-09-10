// The page list, one line per page. `checkPages` in `vite.config.ts` fails the build when a listed
// path has no file, and `sourceOf` throws at module load with the same message in a dev server.

const RAW = import.meta.glob(
  ["../README.md", "../docs/*.md", "../bench/*.md", "../demo/*.md", "../out/visual/*.md"],
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>

/** How a page reaches the screen. `parity` reads the tables; `stats` builds itself from stats.json. */
export type PageView = "markdown" | "parity" | "stats"

export interface SitePage {
  readonly slug: string
  readonly title: string
  /** 1-based position in the nav, which is the order of the list below. */
  readonly order: number
  /** Empty for a view that builds its own content, which is why `source` is empty too. */
  readonly path: string
  readonly source: string
  readonly view: PageView
}

function sourceOf(path: string): string {
  const source = RAW[path]
  if (source === undefined) {
    const known = Object.keys(RAW).sort().join("\n  ")
    throw new Error(`site/content.ts lists ${path}, which has no file. Files found:\n  ${known}`)
  }
  return source
}

interface PageSpec {
  readonly slug: string
  readonly title: string
  readonly path?: string
  readonly view?: PageView
}

// The order of this array is the order of the nav.
const SPECS: readonly PageSpec[] = [
  { slug: "overview", title: "Overview", path: "../README.md" },
  { slug: "guide", title: "Guide", path: "../docs/2_guide.md" },
  { slug: "api", title: "API", path: "../docs/0_api.md" },
  { slug: "parity", title: "Parity", path: "../docs/1_parity.md", view: "parity" },
  { slug: "competitors", title: "Competitors", path: "../docs/3_competitors.md" },
  { slug: "proof", title: "Proof", path: "../docs/4_proof.md" },
  { slug: "benchmarks", title: "Benchmarks", path: "../bench/README.md" },
  // Slug is `demo-guide`, not `demo`: the built demo app occupies `demo/` in the same tree, so a
  // cold load of `/demo` would hit the app rather than this page and the doc would be unreachable.
  { slug: "demo-guide", title: "Demo", path: "../demo/README.md" },
  { slug: "stats", title: "Receipts", view: "stats" },
]

export const PAGES: readonly SitePage[] = SPECS.map((spec, index) => ({
  slug: spec.slug,
  title: spec.title,
  order: index + 1,
  path: spec.path ?? "",
  source: spec.path === undefined ? "" : sourceOf(spec.path),
  view: spec.view ?? "markdown",
}))

export const HOME: string = PAGES[0]?.slug ?? "overview"

export const pageBySlug = (slug: string): SitePage | undefined =>
  PAGES.find((page) => page.slug === slug)
