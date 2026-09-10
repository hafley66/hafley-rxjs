import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { transformerTwoslash, type VitePressPluginTwoslashOptions } from "@shikijs/vitepress-twoslash"
import typescript from "typescript-api"
import { defineConfig } from "vitepress"
import { withMermaid } from "vitepress-plugin-mermaid"
import { BASE, PAGES, routeOf, targetOf } from "../content.js"

// The `typescript` this package pins is the native 7.x compiler, which ships neither the language
// service twoslash drives nor the `lib.*.d.ts` files it reads; `typescript-api` is 5.x for that job.
const PACKAGE_ROOT = process.cwd()

const twoslashOptions = {
  tsModule: typescript,
  tsLibDirectory: dirname(createRequire(import.meta.url).resolve("typescript-api")),
  vfsRoot: PACKAGE_ROOT,
  compilerOptions: {
    baseUrl: PACKAGE_ROOT,
    paths: { "@hafley66/signal-grid": [join(PACKAGE_ROOT, "src/index.ts")] },
    strict: true,
    noUncheckedIndexedAccess: true,
  },
  // Twoslash declares `tsModule` as `typeof import("typescript")`, which under the pinned 7.x is a
  // stub carrying only a version, so a real 5.x compiler cannot satisfy the declared shape.
} as unknown as VitePressPluginTwoslashOptions["twoslashOptions"]

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
      // `explicitTrigger` keeps every plain ```ts fence out of the compiler; only ```ts twoslash
      // is checked, and a block that stops compiling fails this build.
      codeTransformers: [transformerTwoslash({ explicitTrigger: true, twoslashOptions })],
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
