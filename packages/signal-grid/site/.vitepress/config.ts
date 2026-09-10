import { defineConfig } from "vitepress"
import { withMermaid } from "vitepress-plugin-mermaid"
import { BASE, PAGES, routeOf, targetOf } from "../content.js"

// `pages/` is the copy of `docs/dist` that `pnpm site:content` makes; documents PAGES does not name stay out.
const RENDERED = PAGES.filter((page) => page.source.startsWith("pages/")).map((page) =>
  page.source.slice("pages/".length, -".md".length),
)

const rewrites = Object.fromEntries(
  PAGES.filter((page) => page.source !== targetOf(page)).map((page) => [page.source, targetOf(page)]),
)

export default withMermaid(
  defineConfig({
    title: "signal-grid",
    description:
      "signal-grid: a relational data grid kernel. Two ordered forests, five pure operators, RxJS intents, signal derivation.",
    base: BASE,
    srcExclude: [`pages/!(${RENDERED.join("|")}).md`],
    outDir: "./dist",
    cleanUrls: true,
    rewrites,
    markdown: {
      config(md) {
        // Inline code stays literal: `docs/3_competitors.md` quotes a JSX prop written `{{ ... }}`.
        md.core.ruler.push("inline_code_v_pre", (state) => {
          for (const block of state.tokens) {
            for (const child of block.children ?? []) {
              if (child.type === "code_inline") child.attrSet("v-pre", "")
            }
          }
        })
      },
    },
    // The hub's tab strip; `scripts/pages.mjs` at the repository root guarantees it exists on Pages.
    head: [["script", { src: "/hafley-rxjs/strip.js", defer: "" }]],
    themeConfig: {
      sidebar: PAGES.map((page) => ({ text: page.title, link: routeOf(page) })),
      search: { provider: "local" },
      outline: { level: [2, 3] },
      socialLinks: [{ icon: "github", link: "https://github.com/hafley66/hafley-rxjs" }],
    },
    vite: {
      server: { port: 5180, strictPort: true },
      preview: { port: 5181, strictPort: true },
      // `vitepress-plugin-mermaid` asks to pre-bundle these under their bare names, which pnpm does
      // not place beside this package; the `>` form points the optimizer at mermaid's own copy.
      optimizeDeps: {
        include: [
          "mermaid > @braintree/sanitize-url",
          "mermaid > cytoscape",
          "mermaid > cytoscape-cose-bilkent",
          "mermaid > dayjs",
          "mermaid > debug",
        ],
      },
    },
  }),
)
