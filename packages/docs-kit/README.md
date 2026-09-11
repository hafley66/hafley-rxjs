# @hafley66/docs-kit

The documentation apparatus every package in this workspace shares. It ships no library surface of
its own: a package that consumes it gets a site, a live demo panel, a receipts page and a doc lint,
and writes only the parts that are about its own subject.

## Contents

- [What is in it](#what-is-in-it)
- [Wiring a package to it](#wiring-a-package-to-it)
- [What stays in the package](#what-stays-in-the-package)
- [The API reference](#the-api-reference)

## What is in it

| file | what it answers |
| --- | --- |
| `src/0_types.ts` | the five-field `Example` contract every runnable demo satisfies |
| `src/1_in_view.ts` | `mountInView` and `runWhenInView`: a demo names a source, the page decides when it runs |
| `src/2_embeds.ts` | the `require` table an edited demo's `import` lines are answered from |
| `src/3_meters.ts` | one frame loop behind the fps corner meter and every panel's timing strip |
| `src/4_content.ts` | `SitePage`, `SiteGroup`, and the route and target rules |
| `src/5_stats.ts` | the `Stats` shape, the receipts tables, the footer strip |
| `src/6_config.ts` | `docsConfig`, the VitePress config every site is a call to |
| `theme/Demo.vue` | the panel: mount, CodeMirror over the `?raw` source, re-run on edit |
| `theme/index.ts` | `docsTheme`, which registers the panel under whatever name a site's markdown spells |
| `scripts/docs.mjs` | the lint: stale citations, missing files, unknown symbols, raw digits, placeholders |
| `scripts/stats.mjs` | the measurement groups that are not about what the package does |
| `scripts/examples.mjs` | the chromium pass: mount, tear down, count what survived, sample the heap |
| `scripts/api.mjs` | the API reference, read out of the TypeScript program |
| `examples/harness.ts` | the page-side half of that pass |

## Wiring a package to it

```ts
// site/.vitepress/theme/index.ts
import { docsTheme } from "@hafley66/docs-kit/theme"
import { byId } from "../../../examples/index.js"
import { EMBEDS } from "../../embeds.js"
import { STATS, SECTIONS } from "../../stats.js"

export default docsTheme({
  demos: { byId, evaluate: EMBEDS.evaluate, registry: "examples/index.ts" },
  stats: STATS,
  sections: SECTIONS,
  demoComponent: "GridDemo",
})
```

The site's own `content.ts` declares the page tree and hands it to `docsConfig`. Nothing else in
`.vitepress/` is a file the package has to write.

## What stays in the package

Whatever knows the subject. `signal-grid` keeps its parity matrix, its feature ledger, its 100k-row
memory probe and its benchmark tables; `signals` keeps its four-form vocabulary. The test of a
change to this package is whether both sites could drop it without losing anything that is about
them.

## The API reference

`scripts/api.mjs` reads the barrel for what is public, each module for what it declares, and the
checker for every signature. `DECISION-autodoc.md` records the candidates weighed before it was
written, and the error that ruled out the strongest of them.
