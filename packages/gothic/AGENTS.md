# packages/gothic

Rules for agents editing this package (user-set 2026-09-07):

- Never change an existing generator or implementation unless the user says so explicitly.
- New behaviour = a new function (copy the closest one and diverge). Old rows in the notebook stay.
- Refactor, merge, or de-duplicate only when the user says "copy", "combine", or "clean" for those functions.
- Keep code tight.

## Stack

| piece | choice |
|---|---|
| app | one React 19 SPA, `index.html` -> `src/main.tsx`, vite |
| routing | `@hafley66/path` (`route` / `queryRoute`) + `src/app/1_router.ts`; history under the dev server, hash under `file:` |
| state | `@hafley66/signals` only (`SignalReact` for every reactive component). No useState for app state |
| storage | `src/kit/3_store.ts`: `gothic.<page>.<section>.current` autosave, `.states` named list, `.selected` = the state that receives every edit |
| styles | Tailwind v4 via `@tailwindcss/vite`; `src/app.css` holds only the theme vars, keyframes, the `data-z` depth rule and `@view-transition` |
| generators | `src/lib/**`, `src/lib/legacy/**`, `src/algos/**`: pure, no React, path strings only |

Commands: `pnpm --filter @hafley66/gothic dev | build | build:single | typecheck | test | smoke | check`. `check` = typecheck + test + build:single + smoke (`scripts/0_smoke.mjs`, playwright: every tab renders, zero console errors, tab x identical, file:// works). Human onboarding: `README.md` (run, study loop, add a page / field / algo).

## Layout

| path | role |
|---|---|
| `src/app/0_pages.ts` | the page list; builds one `queryRoute(specs, path)` per notebook and matches the current path |
| `src/app/1_router.ts` | `loc` signal, `parseHref` / `toHref`, `navigate`, `writeSearch`, popstate + hashchange |
| `src/app/2_state.ts` | `sectionState(page, id, spec)`: values + pins signals, url read/write, autosave, shuffle, named states |
| `src/app/3_view.ts` | `transition()`: `startViewTransition` around a `flushSync`, armed only after the first commit |
| `src/app/4_App.tsx` | header + the matched page |
| `src/ui/` | `0_hooks` (clock), `2_Section` (kit `Section` bound to `sections`: a sticky `<details class="kit-drawer">` per section whose summary is the title and whose body is the `SpecPanel`, then the host), `3_Header` (kit `NavTabs`: tabs, anchors, title, page knobs in the end slot), `4_Algo`, `5_Raw` |
| `src/app/4_App.tsx` | header (`PagePanel` = zDepth/draw-in in the tab row end slot), then `<main>`; no page-level drawer, each section carries its own |
| `src/kit/` | `0_spec` (field format, shuffle, pins), `1_url` (namespaced query), `2_algo` (Algo contract), `3_store` |
| `src/pages/` | one module per route, each exporting `PAGE: PageSpec` |
| `src/lib/eye/` | the eye anatomy module (SHAPES, EXPR, AU, activate, frame, lidPts, lashSlots, lashLines, TIMING, scheduler, blinkAt); `/eye` has a `timing` section whose spec mirrors `TIMING`, so the route is the module's test rig |
| `src/lib/legacy/` | the single-file notebooks' generators, moved unchanged (`.js` + a hand-written `.d.ts`) |

## Routes

`/eye` `/slice` `/icons` `/border` `/fractal` `/circles` `/tiles` `/arches` `/frames`. `/` redirects to `/eye`.

## Section contract

- One section = one url namespace: `?<section>.<key>=`, pins at `?<section>.pin=a,b`, plus the page-global `?page.z` and `?page.draw`.
- Input = replaceState, shuffle / preset / chip load = pushState, popstate restores. Foreign query keys survive a write.
- Start values: defaults, then the localStorage autosave, then the url keys that are present.
- Specs derive everything: `kind` is `range | number | seed | select | bool | text`; `static: true` or `shuffle: false` moves a field into the last column with no pin and no reroll; `group` clusters it; `roll` narrows the shuffle window; `pool` weights a select; `p` is a bool's true-probability.
- Shuffle skips static and pinned fields and rolls everything else from one seeded rng.
- Depth: paths carrying `data-z` (0 near .. 1 far) fade and thin with the header's zDepth; sections opt in with `zDepth: true`.
- Anchors: the header's row 2 lights each section on its own named view timeline, with an IntersectionObserver fallback.
- Named states: `state.save(name)` creates or overwrites by name and selects it; while a state is selected every edit is written into it as well as the autosave; `state.roll(key)` rerolls one field.

## Adding a page

1. `src/pages/<n>_<name>.tsx`: declare one `Spec` per section, render `<Section page="<name>" def={{ id, title, spec }}>{v => ...}</Section>`, export `PAGE: PageSpec` (`id`, `title`, `path`, `specs`, optional `anchors` for bar-less sections, `Component`).
2. Add the module to `PAGES` in `src/app/0_pages.ts`. The tab, the route, the query schema and the anchors all follow from it.
3. Generators go to `src/lib/**` or `src/algos/**`, never into the component.

## file:// build

`pnpm --filter @hafley66/gothic build:single` writes one inlined `dist/index.html` (vite-plugin-singlefile, `base: "./"`). Opened from `file:`, the router switches to hash urls (`dist/index.html#/eye?eye.seed=3`), so every route and every section's query state work without a server. `pnpm build` writes the same app as a normal asset build.

## Not ported

- `arches`: the first six sections (families, spread, lobes, anatomy, rose, panel) carry bars; the remaining nine (flamboyant, pinnacle, vault, buttress, bands, facade, noisy, grammar, grammar2) render from the same generators on the families bar's globals. The `tex` section is dropped: it loaded textures.js from a CDN, which no single-file build can carry.
