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
| state | `@hafley66/signals` with `signalsJsx()` automatic JSX tracking; plain reactive components. No useState for app state |
| storage | `@hafley66/report-shell` spec store, using signals' `storageSignal`: `gothic.<page>.<section>.current` autosave, `.states` named list, `.selected` = the state that receives every edit |
| styles | Tailwind v4 via `@tailwindcss/vite`; `src/app.css` holds only the theme vars, keyframes, the `data-z` depth rule and `@view-transition` |
| generators | `src/lib/**`, `src/lib/legacy/**`, `src/algos/**`: pure, no React, path strings only |

Commands: `pnpm --filter @hafley66/gothic dev | scaffold | build | build:single | typecheck | test | test:e2e | check`. `check` = typecheck + test + build:single + test:e2e (Playwright over local HTML, including a generated notebook). Human onboarding: `README.md` (run, study loop, scaffold commands).

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
| `src/kit/` | `2_algo` (Algo contract); specs, URL helpers, store and section state come from `@hafley66/report-shell` |
| `src/pages/` | one module per route, each exporting `PAGE: PageSpec` |
| `src/lib/eye/` | the eye anatomy module (SHAPES, EXPR, AU, activate, frame, lidPts, lashSlots, lashLines, TIMING, scheduler, blinkAt); `/eye` has a `timing` section whose spec mirrors `TIMING`, so the route is the module's test rig |
| `src/lib/legacy/` | the single-file notebooks' generators, moved unchanged (`.js` + a hand-written `.d.ts`) |

## Routes

`/eye` `/slice` `/icons` `/border` `/fractal` `/circles` `/tiles` `/arches` `/frames` `/fma` `/guilloche` `/architecture`. `/` redirects to `/eye`.

## Section contract

- One section = one url namespace: `?<section>.<key>=`, pins at `?<section>.pin=a,b`, plus the page-global `?page.z` and `?page.draw`.
- Input = replaceState, shuffle / preset / chip load = pushState, popstate restores. Foreign query keys survive a write.
- Start values: defaults, then the localStorage autosave, then the url keys that are present.
- Specs derive everything: `kind` is `range | number | seed | select | bool | text`; geometry fields have a pin and reroll; playback and variation controls use `static: true`, stay above the drawer, and survive shuffle; `group` clusters it; `roll` narrows the shuffle window; `pool` supplies text choices or weights a select; `p` is a bool's true-probability.
- Shuffle skips static and pinned fields and rolls everything else from one seeded rng.
- Depth: paths carrying `data-z` (0 near .. 1 far) fade and thin with the header's zDepth; sections opt in with `zDepth: true`.
- Anchors: the header's row 2 lights each section on its own named view timeline, with an IntersectionObserver fallback.
- Named states: `state.save(name)` creates or overwrites by name and selects it; while a state is selected every edit is written into it as well as the autosave; `state.roll(key)` rerolls one field.

## Adding a page

For requests to notebook something new, use `pnpm scaffold page <id>` first. The checked-in Bash script and templates determine the boilerplate. Then edit the emitted `SPEC` and `generate(p, ctx)` body. Do not invent another page, state, input or registration pattern.

- `pnpm scaffold section <page> <id>` creates and mounts another Algo.
- `pnpm scaffold input <algo> <key> <kind>` inserts a literal field template; edit its bounds, defaults, options and hint for the requested input.
- `pnpm scaffold use <page> <section> <module>:<export>` mounts an existing Algo under a separate section namespace.
- `pnpm scaffold copy <source> <id>` copies a scaffolded Algo for independent changes; mount the printed module with `use`.
- `pnpm scaffold input --print <key> <kind>` prints the field template for a handwritten spec.
- Add `--dry-run` to inspect an exact diff. Keep `scaffold:*` markers intact for subsequent edits.

Generated pages use plain JSX with the signals interceptor and the existing `AlgoSection`/`Section`/`createSections` chain. Use its signal-backed values, pins, storage and kit controls. Generators stay pure in `src/lib/**` or `src/algos/**`. Run `pnpm check` after implementing the generator.

Adding sections to a handwritten page generates a wrapper around its existing `PAGE`. Existing generators and notebook rows remain in place. Composition via `use` renders separate sections; every section name must be unique within that page, including its inherited specs and anchors.

## file:// build

`pnpm --filter @hafley66/gothic build:single` writes one inlined `dist/index.html` (vite-plugin-singlefile, `base: "./"`). Single builds use hash URLs on both HTTP and `file:` (`dist/index.html#/eye?eye.seed=3`), so every route and every section's query state work on static hosts. `pnpm build` writes the same app as a normal asset build. `pnpm publish:pages` builds and publishes the HTML to `origin`'s `gh-pages` branch, enabling GitHub Pages on its first run.

## Architectural studies

`/architecture` adds six independent Algos in `src/algos/4_architecture.ts` through `9_cloister.ts`. Shared pointed-arch and spire geometry lives in `src/lib/2a_architecture.ts`. `/guilloche` uses `src/algos/3_guilloche.ts`. Each uses the existing AlgoSection and section state; the legacy arches and building generators retain their original rows.

## Not ported

- `arches`: the first six sections (families, spread, lobes, anatomy, rose, panel) carry bars; the remaining nine (flamboyant, pinnacle, vault, buttress, bands, facade, noisy, grammar, grammar2) render from the same generators on the families bar's globals. The `tex` section is dropped: it loaded textures.js from a CDN, which no single-file build can carry.

## Slice reuse and shuffle (user-set 2026-09-08)

The slice toolkit is exported from `src/kit/slice/index.ts`, with a separate React hook. Reuse its segmentation, schedule, gap distributions, poses and clock when requesting that animation. Each technique remains opt-in. FMA adds five distinct sections in `src/pages/14_fma.tsx`; its original notebook stays as the base.

`<Section slice>` / `<AlgoSection slice>` attach the shared SVG stage. FMA and circles expose a `timing` namespace for it. The original Slice seal remains the default; optional core functions live in `src/lib/3a_sealCore.ts`. `weight` controls moving Slice strokes and `finalWeight` controls completed paths.

Each spec input has a property-timeline settings slot. `src/kit/4_propertyMotion.ts` owns one grouped config and one cold clock per page, with section and field overrides. Source-signal projections sample live values without writing animation frames to saved inputs or shuffle pins. Timing tables persist separately in `gothic.<page>.timelines`. Field cycles run inside the page timeline. Header controls share the `*` page timeline. Do not replace the source projection with a computed signal that pins producer connections on a synchronous read.

Geometry inputs are shuffleable and pinnable. Playback and variation configuration are static controls above the drawer. Every input label carries its own tooltip. Text fields need a `pool`; number fields need finite `min`/`max`.

## Signals authoring

Use the shipped [signals skill](../signals/skills/signals/SKILL.md). Group related state in one root and use nested path proxies. Source signals own RxJS connections; tracked JSX reads activate them. Animation components do not manually subscribe or use `useEffect` to connect producers. The editable skill source is `~/projects/claude-research/skills/signals/SKILL.md`.

## Variation permissions (user-set 2026-09-08)

Variation defaults to None. Per-property policies are `none`, `global`, and `cascade`: None blocks variation; global reads only the page option set; cascade overlays page, section, then explicit field overrides. Merely editing defaults never enables another property. Clearing an override returns it to inheritance. Timing and geometry shuffle remain separate from these stored options.

`src/lib/7a_variation.ts` samples repeatable mixed distributions and harmonic, drift or held signals by time and identity. `src/lib/7b_propertyVariation.ts` applies them to typed inputs; `src/lib/7c_sliceVariation.ts` composes the original Slice pose with per-stroke appearance. Original Slice remains unchanged with variation disabled. The property clock and its stroke projections use the existing signal/RxJS ownership.
