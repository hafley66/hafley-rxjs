// The VitePress config every site in this workspace is a call to. A site hands over its content
// tree and its title; sidebar, rewrites, hub strip and mermaid wiring are the same in all of them.
import { defineConfig, type UserConfig } from "vitepress"
import { withMermaid } from "vitepress-plugin-mermaid"
import { pagesOf, routeOf, targetOf, type SiteContent } from "./4_content.ts"

/** The hub's tab strip; `scripts/pages.mjs` at the repository root guarantees it exists on Pages. */
export const STRIP_SRC = "/hafley-rxjs/strip.js"

export interface DocsSiteOptions {
  readonly title: string
  readonly description: string
  readonly content: SiteContent
  /** Documents the content tree does not name, excluded rather than built into an unlinked page. */
  readonly srcExclude?: readonly string[]
  readonly devPort: number
  readonly previewPort: number
  /** Merged over what this factory builds, for the one setting a site does differently. */
  readonly vite?: UserConfig["vite"]
}

// `vitepress-plugin-mermaid` asks to pre-bundle these under their bare names, which pnpm does not
// place beside a site package; the `>` form points the optimizer at mermaid's own copy.
const MERMAID_DEPS = [
  "mermaid > @braintree/sanitize-url",
  "mermaid > cytoscape",
  "mermaid > cytoscape-cose-bilkent",
  "mermaid > dayjs",
  "mermaid > debug",
]

export function docsConfig(options: DocsSiteOptions): UserConfig {
  const content = options.content
  const pages = pagesOf(content)

  const rewrites = Object.fromEntries(
    pages.filter((it) => it.source !== targetOf(content, it)).map((it) => [it.source, targetOf(content, it)]),
  )

  const sidebar = [...content.groups, content.receipts].map((group) => ({
    text: group.text,
    collapsed: false,
    items: group.pages.map((page) => ({ text: page.title, link: routeOf(content, page) })),
  }))

  return withMermaid(
    defineConfig({
      title: options.title,
      description: options.description,
      base: content.base,
      srcExclude: [...(options.srcExclude ?? [])],
      outDir: "./dist",
      cleanUrls: true,
      rewrites,
      markdown: {
        config(md) {
          // Inline code stays literal: a competitors page quotes a JSX prop written `{{ ... }}`.
          md.core.ruler.push("inline_code_v_pre", (state) => {
            for (const block of state.tokens) {
              for (const child of block.children ?? []) {
                if (child.type === "code_inline") child.attrSet("v-pre", "")
              }
            }
          })
        },
      },
      head: [["script", { src: STRIP_SRC, defer: "" }]],
      themeConfig: {
        sidebar,
        search: { provider: "local" },
        outline: { level: [2, 3] },
        socialLinks: [{ icon: "github", link: "https://github.com/hafley66/hafley-rxjs" }],
      },
      vite: {
        server: { port: options.devPort, strictPort: true },
        preview: { port: options.previewPort, strictPort: true },
        ...options.vite,
        // Merged rather than replaced: a site adding a plugin must not have to restate these.
        optimizeDeps: {
          ...options.vite?.optimizeDeps,
          include: [...MERMAID_DEPS, ...(options.vite?.optimizeDeps?.include ?? [])],
          exclude: ["@hafley66/docs-kit", ...(options.vite?.optimizeDeps?.exclude ?? [])],
        },
        ssr: { ...options.vite?.ssr, noExternal: ["@hafley66/docs-kit"] },
      },
    }),
  )
}

/** The `pages/` sources a site names, as the glob `srcExclude` needs to keep the rest out. */
export const renderedOnly = (content: SiteContent): string => {
  const rendered = pagesOf(content)
    .filter((it) => it.source.startsWith("pages/"))
    .map((it) => it.source.slice("pages/".length, -".md".length))
  return `pages/!(${rendered.join("|")}).md`
}
