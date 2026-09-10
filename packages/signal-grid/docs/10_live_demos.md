# 8. Live demos: buy vs build

## Contents

1. [What MUI X actually runs](#1-what-mui-x-actually-runs)
2. [Candidates](#2-candidates)
3. [Recommendation](#3-recommendation)
4. [Integration sketch](#4-integration-sketch)
5. [What this does not solve](#5-what-this-does-not-solve)

## 1. What MUI X actually runs

Read from source on 2026-09-10, branch `master` of
github.com/mui/material-ui. The demo stack lives in `packages-internal/core-docs`
(published to npm as `@mui/docs@7.3.9`, MIT, `npm view @mui/docs`).

| piece | package, version | what it does | React-only parts |
|---|---|---|---|
| live runner | `react-runner@^1.0.5` | compiles edited JSX/TSX in-page and renders it against a `scope` of components; `useRunner({ code, scope })` returns `{ element, error }` | all of it, it returns a React element |
| transform engine | `sucrase@^3.21.0` (a `react-runner` dependency, `npm view react-runner dependencies`) | TS/JSX to JS, no type checking | none, it is a pure string transform |
| editor | `react-simple-code-editor@^0.14.1` | textarea overlaid on a highlighted `pre` | the component itself, 8.6 kB min / 3.4 kB gzip (https://bundlephobia.com/api/size?package=react-simple-code-editor) |
| highlighter | `prismjs@^1.30.0` via `@mui/internal-markdown@3.0.12` | tokenizes for the editor's backdrop | the prism core is plain JS; MUI wires it inside React components |
| sandbox handoff | `lz-string@^1.5.0` + hidden form POST | "edit in the browser" opens CodeSandbox (define API) or StackBlitz (`https://stackblitz.com/run`) in a new tab | the URL building is plain DOM, no React |

Source files read (file names inside the `Demo` and `Demo/sandbox`
directories of https://github.com/mui/material-ui/tree/master/packages-internal/core-docs/src/Demo
and https://github.com/mui/material-ui/tree/master/packages-internal/core-docs/src/Demo/sandbox):

- `Demo.tsx` (toolbar, collapse, reset, editor state) and `DemoEditor.tsx`
  (the `react-simple-code-editor` + prism wiring, including the CJS interop
  comment quoted above)
- `ReactRunner.tsx`, the `useRunner({ code, scope })` call site; upstream
  documented at https://github.com/nihgwu/react-runner
- `StackBlitz.ts`: a hidden form POST to `https://stackblitz.com/run`,
  documented at https://developer.stackblitz.com/docs/platform/post-api/
- `CodeSandbox.ts`: `LZString.compressToBase64` + a POST form to
  `https://codesandbox.io/api/v1/sandboxes/define`,
  documented at https://codesandbox.io/docs/api/#define-api

So the MUI live path is two separable halves: a React-bound render loop
(`react-runner`), and under it a framework-free compiler (`sucrase`) plus a
framework-free highlighter (`prismjs`). The "expand code" collapse and the
copy/reset toolbar are MUI's own components. The sandbox buttons leave the page
entirely; MUI never runs npm installation in-page.

## 2. Candidates

Downloads read 2026-09-10 from
`https://api.npmjs.org/downloads/point/last-week/<pkg>`; versions, licenses, and
release dates from `npm view <pkg> version license time.modified`; weights from
`https://bundlephobia.com/api/size?package=<pkg>` (min+gzip, dependencies
included) plus one measured unpkg download. The site it must land on: a plain Vite
TypeScript site (`site/`) published as static files to GitHub Pages, with no
server at runtime and its bundle size published in `site/stats.json` (current
assets: {{stats.bundle.site.totalBytes}} bytes raw / {{stats.bundle.site.totalGzipBytes}} gzip across
{{stats.bundle.site.fileCount}} files, from `site/stats.json` `bundle.site`).

| candidate | what it does | license | weekly downloads | last release | install weight | no React | static Pages | one reason it loses |
|---|---|---|---|---|---|---|---|---|
| `sucrase@3.35.1` | TS/JSX to JS string transform, in-page, no type check | MIT | 26,161,232 | 2025-11-19 | 197.9 kB min / 43.5 kB gzip | yes | yes | transforms imports without resolving them, the embed shim owns module wiring |
| `@codesandbox/sandpack-client@2.19.8` | in-browser bundler + preview iframe, vanilla API | Apache-2.0 | 663,933 | 2025-04-29 | 6.5 kB min / 2.8 kB gzip shell, then the bundler runtime streams from codesandbox CDN | yes | yes | the runtime iframe pulls megabytes from their CDN at mount, so demos need network and first paint is slow |
| `@stackblitz/sdk@1.11.1` | embeds a project running on stackblitz.com (WebContainers on their origin) | MIT | 70,626 | 2026-07-02 | 8.3 kB min / 3.5 kB gzip | yes | yes | the demo leaves the page inside their chrome, which drops the "source beside the running grid" layout MUI-style demos keep |
| CodeSandbox Define API | URL/form-encoded sandbox, no package, no account | service terms | n/a | n/a | 0 bytes, `lz-string@1.5.0` (4.8 kB min / 1.5 kB gzip) if compressing client-side | yes | yes | the demo runs on codesandbox.io behind a network round trip, same layout loss as the SDK row |
| `esbuild-wasm@0.28.2` | full esbuild compiler as wasm, bundles plus transforms | MIT | 2,864,207 | 2026-08-08 | 69.0 kB min / 19.2 kB gzip JS shim plus a 13,978,850-byte wasm blob (measured: `curl -sL -o /tmp/esb.wasm -w "%{size_download}" https://unpkg.com/esbuild-wasm@0.28.2/esbuild.wasm`) | yes | yes | the wasm blob is 94x the whole current gzip site for a job sucrase does in 43.5 kB gzip |
| `@babel/standalone@8.0.4` | babel in-page, TS preset plus JSX | MIT | 540,424 | 2026-08-03 | 2,301.9 kB min / 567.7 kB gzip | yes | yes | 13x sucrase's gzip weight for the same strip-types-and-JSX job on this site |
| `codemirror@6.0.2` (meta package) | the editor half: state, view, language, commands | MIT | 5,450,551 | 2026-02-07 | 373.2 kB min / 118.7 kB gzip | yes | yes | edits text and nothing else, it must pair with a compiler row |
| `react-runner@1.0.5` (the MUI engine) | compiles and renders a React scope in-page | MIT | 21,933 | 2024-06-05 | 219.0 kB min / 50.5 kB gzip | no, returns React elements | yes | React-only render loop, this repo has no React to render into |
| `react-live@4.1.8` | react-runner-style live editing as a component | MIT | 243,779 | 2026-07-20 | 296.9 kB min / 74.9 kB gzip | no, partial fit | yes | React-only, included because it is the common default answer |
| docs-framework plugins (Docusaurus live-codeblock, VitePress live plugins, Starlight expressive-code) | live-code or static-code blocks inside a docs framework | varies | n/a | n/a | framework-sized | Docusaurus live-codeblock wraps `react-live` (https://docusaurus.io/docs/markdown-features/code-blocks, "Live code editor" section); VitePress plugins are Vue components; Starlight's expressive-code is static | partial fit for any | adopting one means replacing the hand-rolled Vite site in `site/`, a framework rewrite to buy one feature |
| do nothing new, link out per demo | one button per example, POST the source to StackBlitz/CodeSandbox exactly like `CodeSandbox.ts` above | n/a | n/a | ~0 bytes, `lz-string` only | yes | yes | the owner named editable-in-page as the want; a tab that opens elsewhere fails that requirement directly |

## 3. Recommendation

**Winner: `sucrase` + `codemirror@6`, both dynamically imported from a new
embed module.** The deciding number: sucrase compiles edited TypeScript for
43.5 kB gzip (https://bundlephobia.com/api/size?package=sucrase) against a
13,978,850-byte wasm blob for esbuild-wasm, and both load on demand so
`site/stats.json`'s index figure moves by roughly zero. It is the same engine
MUI's own live demos sit on (`react-runner` declares `sucrase@^3.21.0`),
lifted out of its React wrapper.

**Runner-up: `@codesandbox/sandpack-client`.** Vanilla API, real npm dependency
resolution, and a preview iframe the page owns. It loses on the network fetch
of the bundler runtime at mount and the slower first paint per demo.

## 4. Integration sketch

Files touched: `site/embeds.ts` (the seam, currently `EMBEDS = {}` at
`site/embeds.ts:10`), one new live.ts module in `site/`, and `package.json`
for the two dev dependencies. `site/main.ts` already calls `EMBEDS[slug]` and
catches a throwing embed (`site/main.ts:258-270`), so it changes nothing. The examples
already carry their own text (`source` via `?raw` self-import, declared in
`examples/0_types.ts`) and a `mount`/teardown pair, registered in
`examples/index.ts`.

```ts
// the new live module in site/
type ModuleMap = Record<string, Record<string, unknown>>
// module specifier ("../src/index.js", "rxjs") -> that module's exports, all
// read from the already-bundled site chunk at build time via `import * as`.

type CompileResult = { ok: true; code: string } | { ok: false; error: string }
// sucrase.transform(code, { transforms: ["typescript", "imports"] }) wrapped in
// a try/catch; the imports transform rewrites each import statement into a
// destructuring read from the scope object, so edited code keeps authoring
// real `import` lines.

function createLiveEditor(host: HTMLElement, config: {
  source: string
  modules: ModuleMap
}): () => void
// pseudo-code:
//   const scope = buildScope(config.modules)
//   const editor = await import("codemirror") then mount into host
//   const { transform } = await import("sucrase") on first edit, keep cached
//   on every doc change (debounced ~300ms, same number MUI's Demo.tsx uses):
//     const result = compile(it)          // CompileResult above
//     result.ok ? run(result.code, scope) : renderInlineError(result.error)
//   run(code, scope):
//     tear down the previous grid (its own returned stop function)
//     const fn = new Function(...scopeKeys, code + "; return mount(host)")
//     keep the teardown fn() returns, call it before the next run and on reset
//   reset button restores config.source and reruns once
//   return () => { teardown(); editor.destroy() }   // the embed's unsubscribe
```

```ts
// site/embeds.ts (becomes)
function liveEmbed(example: Example, modules: ModuleMap): Embed
// pseudo-code:
//   return (content) => createLiveEditor(embedHost(content), {
//     source: example.source, modules,
//   })

export const EMBEDS: Readonly<Record<string, Embed | undefined>> = {
  "flat-list": liveEmbed(flatList, SITE_MODULES),
  // one line per examples/*.ts entry, keyed by the page slug main.ts passes
}
```

```ts
// the live module, continued: the scope bridge
const SITE_MODULES: ModuleMap = { /* "../src/index.js": gridExports, "rxjs": rxjsExports */ }
// pseudo-code:
//   import * as gridExports from "../src/index.js"
//   import * as rxjsExports from "rxjs"
//   the specifier keys must equal the literal import paths examples/*.ts
//   write today (checked by grepping examples/ at build time in scripts/
//   examples.mjs, which already walks the registry)
```

The lazy `import()` of `codemirror` and `sucrase` keeps their 162.2 kB gzip
combined weight out of the entry chunk `site/stats.json` reports; they arrive
when a reader focuses the first editor.

## 5. What this does not solve

- Type checking in the editor: sucrase strips types without checking them, so
  the live module surfaces runtime errors only, the same trade MUI's Demo makes.
- Multi-file examples: an edited demo importing a sibling file from
  `examples/` resolves only what `ModuleMap` lists.
- CSS imports inside edited source: `src/theme.css` is already loaded once by
  `examples/index.ts`; an edit that needs new CSS re-runs against the old sheet.
- State persistence across reloads: the editor resets with the page unless a
  later lane adds `sessionStorage`, which this sketch leaves out.
- Sandbox escape hatch: the runner-up rows (Sandpack, Define API) remain the
  answer for "open this in a real install", and nothing above builds that
  button.
- Bundle accounting: `scripts/stats.mjs` measures the entry chunk today, so the
  lazy chunks need their own row there before the weight claim in section 3
  becomes a published number.
