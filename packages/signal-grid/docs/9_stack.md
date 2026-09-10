# Stack: the docs site is bought, the receipts are not

`site/` carried a hand-written markdown reader, router, search index, nav, and code renderer.
This record picks the package that replaces them, and picks ahead of time the package the demo lane
will use, so neither decision is made again inside a lane.

## Contents

1. [What stays hand-written](#what-stays-hand-written)
2. [Docs site candidates](#docs-site-candidates)
3. [Demo runner candidates](#demo-runner-candidates)
4. [Decision](#decision)
5. [How the numbers were read](#how-the-numbers-were-read)

## What stays hand-written

| file | why a generator cannot produce it |
| --- | --- |
| `scripts/stats.mjs` | measures the tree and writes `site/stats.json`; a site renders it, nothing else can measure it |
| `scripts/parity.mjs` | walks the source tags and writes `docs/1_parity.md` plus `site/parity.json` |
| `scripts/docs.mjs` | lints every claim and, with `--render`, expands `{{stats.*}}`, `{{bench.*}}`, `{{parity.*}}` into `docs/dist/` |
| `site/stats.ts` | the receipts page; every table is a view over `stats.json` |
| `site/parity.ts` | the parity matrix; the grid this package ships, filtering its own feature list |

The generator's job is everything else: markdown to HTML, sidebar, search, code highlighting,
outline, theme toggle, deep links.

## Docs site candidates

Measured 2026-09-10. `site/` line count before the migration: 2,490 across ten `.ts` files.
"Deletes" counts the `site/` TypeScript files whose whole job the package takes over, by former
name: main (426), md (490), search (104), embeds (23), pitch (399, referenced by nothing),
vite.config (47); 1,489 in total.

| name | version | license | weekly downloads | last release | unpacked kB | framework forced | static output | custom page escape hatch | deletes | the one reason it would lose |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| VitePress | 1.6.4 stable, 2.0.0-alpha.20 on `next` | MIT | 573,601 | 2025-08-05 stable, 2026-09-04 alpha | 2,690 | Vue for a custom component; markdown pages need none | yes | yes: theme layout slots, `.vue` components in `.md`, `srcDir` plus `rewrites` for content outside the site directory | 1,489 | the stable line has had no release in thirteen months; the line that shares the workspace's vite 8 is an alpha |
| Astro Starlight | 0.42.0 on astro 7.3.2 | MIT | 587,342 | 2026-09-02 | 1,136 plus astro 2,957 | Astro components (`.astro`); islands may be framework-free | yes | yes: `<StarlightPage>` and content loaders with an external `base` | 1,489 | a second build system (astro, 53 dependencies) beside a workspace that is already vite 8 end to end |
| Docusaurus | 3.10.2 | MIT | 796,375 | 2026-07-10 | 466 for `@docusaurus/core`, 42 dependencies, plus preset | React, for every custom page and every MDX component | yes | yes, as React components only | disqualified | the no-React rule: the receipts page and the parity grid would have to be wrapped in React |
| Nextra | 4.6.1 | MIT | 128,073 | 2025-12-04 | 394 | Next.js and React | yes, via `next export` | React only | disqualified | the no-React rule, and Next.js as a second framework |
| Rspress | `@rspress/core` 2.0.21 (`rspress` 1.47.2) | MIT | 51,036 core, 14,727 meta | 2026-08-27 | 1,392, 38 dependencies including react, react-dom, react-router-dom | React for custom pages; MDX content | yes | React only | disqualified | the no-React rule, and rsbuild as a second bundler |
| Mintlify | 4.2.883 CLI | Elastic-2.0 | 81,614 | 2026-09-10 | 12 | none in the repository; the renderer is the hosted service | no self-hostable static build | hosted components only | none | the site must be static files on `gh-pages`, and the license is source-available rather than OSI |
| keep `site/` | 0.1.0 | MIT | 0 | every commit | 0 | none | yes | it is nothing but escape hatch | 0 | a hand-maintained markdown reader, router, and search index, 2,490 by `wc -l`, which the owner has forbidden |

## Demo runner candidates

For the later lane. The demo is `@hafley66/signals` plus `@hafley66/xdom` producing DOM directly, so
the runner has to accept a story that is a function returning an `HTMLElement`.

| name | version | license | weekly downloads | last release | unpacked kB | framework forced | static output | custom page escape hatch | the one reason it would lose |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Storybook | 10.6.0 | MIT | 11,239,174 | 2026-09-02 | 21,649 | none: `@storybook/html-vite` takes a story that returns an element; `@types/react` is a types-only peer | yes, `storybook build` | yes: MDX docs pages, addon panels | the install is the largest of the three by an order of magnitude |
| Ladle | 5.1.1 | MIT | 167,719 | 2025-11-04 | 1,257 | React, `react` and `react-dom` are hard peers and every story is a component | yes | React only | the no-React rule |
| Histoire | 1.0.0-beta.1 | MIT | 47,334 | 2026-01-07 | 352 | Vue or Svelte through an official plugin; no vanilla HTML plugin | yes | Vue or Svelte only | no plugin for a story that is a plain element, and its peer is vite ^7.3 against a vite 8 workspace |

Storybook with `@storybook/html-vite` is the only runner of the three that hosts a plain-element
story. Runner-up is the null option: `demo/` keeps its own vite entry until a second demo consumer
appears.

## Decision

Winner: VitePress `2.0.0-alpha.20`, installed from the `next` tag.

- It is a vite plugin set rather than a second bundler, and its `vite` dependency is `^8.2.1`, the
  same major the library build and every test config already use.
- Content stays where it is. `pnpm site:content` runs `scripts/docs.mjs --render`, then copies
  `docs/dist/*.md` to `site/pages/` and the two readmes to `site/benchmarks.md` and
  `site/demo-guide.md`, all git-ignored; `rewrites` map the copied `2_guide` to `guide`. Two shorter
  routes failed in `2.0.0-alpha.20`: a `srcDir` above the site directory drops the client entry
  script and the CSS link from every page, and symlinks resolve to their real path, so a page
  under `docs/dist/` routes as `../docs/dist/2_guide`.
- The two hand-written pages survive as `.vue` shells of under thirty lines each that mount
  `site/stats.ts` and `site/parity.ts` into a `div` on the client.

Runner-up: Astro Starlight `0.42.0`.

- It has the freshest stable release and a comparable download count.
- Islands would host `stats.ts` and `parity.ts` without React.
- It costs an astro toolchain of 53 dependencies beside the vite 8 workspace, which VitePress avoids.

The number that decided it: `^8.2.1`, the vite range VitePress 2 declares. One bundler in the
workspace instead of two. Mermaid fences render through `vitepress-plugin-mermaid` `2.0.17`
(MIT, 214,946 weekly), whose peer range names VitePress 1; the alpha accepts it with a peer warning
and the build check in `pnpm site:build` is what proves it each run.

## How the numbers were read

| field | source |
| --- | --- |
| version, license, last release date, unpacked kB, dependency counts | `https://registry.npmjs.org/<name>` (`dist-tags`, `time`, `versions[latest].dist.unpackedSize`, `dependencies`, `peerDependencies`) |
| weekly downloads | `https://api.npmjs.org/downloads/point/last-week/<name>` |
| `site/` line counts | `wc -l site/*.ts` at commit `240dfdb` |
