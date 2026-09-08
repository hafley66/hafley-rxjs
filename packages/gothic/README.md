# @hafley66/gothic

Procedural gothic line art as one React SPA. Every route is a notebook: one knob sidebar per section (sticky beside the art on wide screens, a full-page sheet on narrow ones) derived from its spec (one row per field: pin, label, control, value, reroll), URL state per section, shuffle with pins, named states, draw-in animation, a shared header with scroll-driven anchors. The point of the package is to study a generator by turning its knobs and to add a new generator in one file.

## TOC

1. Run
2. Routes
3. Study loop: knobs, URL, pins, named states
4. Make: a new page
5. Make: a new field, a new algo, a new generator
6. Validate
7. Where things live
8. Rules
9. Property timelines

## 1. Run

```bash
pnpm --filter @hafley66/gothic dev            # http://localhost:5173/eye
pnpm --filter @hafley66/gothic build:single   # dist/index.html, opens from file:// (hash routing)
pnpm --filter @hafley66/gothic publish:pages # build and publish index.html to origin's gh-pages branch
pnpm --filter @hafley66/gothic check          # typecheck + vitest + build:single + playwright e2e over dist/index.html
```

GitHub Pages: [hafley66.github.io/hafley-rxjs](https://hafley66.github.io/hafley-rxjs/). The single-file build uses hash routes on HTTP and `file://`, so notebook links and reloads work under a repository path. Publishing requires authenticated `gh` and Git access; the command creates Pages on its first run and preserves the publishing branch history.

## 2. Routes

| route | notebook | sections |
|---|---|---|
| `/eye` | eye anatomy on FACS muscles, blink scheduler | `eye`, `timing` (the scheduler's timing table as knobs, scrub, blink now, re-wake, drives readout) |
| `/slice` | judgement-cut stroke reveal | `slice` |
| `/icons` | rule-driven fma seal composer with LOD | `icons`, `seal` |
| `/border` | continuous-path gothic border with pen scrub | `border` |
| `/fractal` | fractal algos on the Algo contract | `apollonian`, `foils`, `lsys`, `cusping`, `hilbert` |
| `/circles` | fma seals, sacred geometry, diagrams | `diagram`, `fma`, `sacred` |
| `/tiles` | islamic star, mosaic, blackwork | `islamic`, `mosaic`, `blackwork` |
| `/arches` | arch families, tracery, buildings, grammar | `families` (page globals), `spread`, `lobes`, `anatomy`, `rose`, `panel`, plus 9 bar-less anchors driven by `families` |
| `/frames` | frame compositions | `frames`, `sizer` |
| `/fma` | fullmetal 2: a transmutation circle where one symmetry n drives the script band, the star {n/k}, n tangent satellites nested as circles of the same family, chords, the dual polygon and the core (`src/algos/2_fma.ts`) | `fma2`, `gallery` |
| `/guilloche` | woven spirograph rosettes, three harmonic wheels, nested bands; engraving/cathedral/solar/lacework presets | `guilloche` |
| `/architecture` | branching lancet tracery, fan vaults, flying buttress frames, crocketed spires, radial wheel windows, perspective cloisters | `architecture`, `fanvault`, `buttresses`, `spires`, `wheel`, `cloister` |

`/` redirects to `/eye`. The page list is `PAGES` in `src/app/0_pages.ts`; tabs, routes, query schemas and anchors all derive from it.

## 3. Study loop

| action | effect | URL |
|---|---|---|
| move a knob | section re-renders, `replaceState` | `?eye.seed=3&eye.segs=64` |
| shuffle | every unpinned field rerolls from one seeded rng, `pushState` | same keys, new values |
| pin (box next to a knob) | shuffle skips it; survives reload and back/forward; clicking the row label toggles the pin; editing a field pins it | `?eye.pin=seed,shape` |
| preset select | applies a partial value set, `pushState` | keys it touches |
| state combobox | the shown name is the state receiving every edit (●). Type an existing name or pick it from the list to load it; type a new name and press Enter to fork the current values into it; list rows carry star and delete. localStorage `gothic.<page>.<section>.states` + `.selected` | none |
| ↻ on a row | rerolls that one field, `pushState` | that key |
| section title row | folds that section's sidebar to one line (chevron) and carries its SHUFFLE button; zDepth, draw-in, page shuffle and SHUFFLE ALL sit at the end of the tab row | none |
| SHUFFLE ALL (tab row) | every section on the page plus zDepth/draw-in reroll from one seed, one pushState | all namespaces |
| autosave | every change lands in `gothic.<page>.<section>.current`; start order is defaults, then autosave, then URL keys present | none |
| zDepth / draw-in (header) | page-global stroke fade by `data-z`, and draw-in time | `?page.z=0.4&page.draw=false` |

Only non-default values print to the URL. Foreign query keys survive a write. Copying the address bar reproduces the view.

## 4. Make: a new notebook

Run the checked-in Bash scaffold from this package:

```bash
pnpm scaffold page rose --dry-run   # inspect the exact diff
pnpm scaffold page rose             # create a generator, a page and its route registration
pnpm scaffold input rose petals range
pnpm dev                            # open /rose
```

`just scaffold ...` and `bash scripts/0_scaffold.sh ...` run the same script.
`pnpm scaffold --help` lists its arguments.

The script prints the files it touches. Numeric prefixes are selected from the current files. A new notebook has:

- `src/algos/<n>_rose.ts`: `SPEC`, inferred `Params`, `generate(p, ctx): AlgoOut`, and `ALGO`.
- `src/pages/<n>_rose.tsx`: the signals JSX interceptor, `AlgoSection`, sizes `[48, 96, 160, 320]`, and `PAGE`.
- An import and entry in `src/app/0_pages.ts`: the tab, route, query schema and anchors follow.

The initial generator draws a circle controlled by `radius`. Edit the field bounds, defaults, options and hints in `SPEC`, then write the geometry in `generate`. Every added field reaches `p` through `ValuesOf<typeof SPEC>`. The scaffold supplies the input; its effect on geometry is written in the generator body. Presets go in `ALGO.presets`.

```bash
pnpm scaffold section rose petals                 # another new Algo and section on /rose
pnpm scaffold input petals count range             # a control in that section's spec
pnpm scaffold use rose comparison 2_fma:fma2        # existing FMA Algo alongside it
pnpm scaffold use rose packing 1_fractal:apollonian
pnpm scaffold copy petals petals2                  # independent copy of a scaffolded Algo
# Use the numbered filename printed by copy, without .ts:
pnpm scaffold use rose variant <n>_petals2:ALGO
pnpm check
```

`use PAGE SECTION MODULE:EXPORT` mounts a directly exported `const NAME: Algo<...>` from `src/algos`. The supplied section name gives each use its own controls, URL namespace and storage, including repeated uses of the same Algo. Composition here means separate sections on one page.

`section` and `use` also work on existing handwritten notebooks. On the first addition, the script creates a numbered wrapper importing the old `PAGE`, preserves its specs and anchors, renders its component, then renders the added sections. It updates that page's registration to the wrapper. Subsequent additions use that wrapper. Choose a section name absent from the base page's specs and anchors; inherited name collisions fail when the page module loads.

`input` and `copy` operate on scaffolded Algos. For a handwritten spec, print a fixed field definition and paste it into the desired spec:

```bash
pnpm scaffold input --print petals range
```

Field kinds are `range`, `number`, `seed`, `select`, `bool`, `text`. Their literal defaults live in `scripts/templates/inputs/`; customize the emitted field before using it for domain values. IDs and keys use lowercase letters, digits and underscores, starting with a letter. `page`, `pin`, `constructor` and `prototype` are reserved.

The `.tpl` files in `scripts/templates/` are text templates containing TypeScript and named placeholders. Bash uses `sed` to substitute names and `awk` to insert lines at `scaffold:*` comments. Keep those comments and the generated import/export forms intact if later scaffold commands should edit that module. Creation refuses existing names; failed argument or marker checks leave source files unchanged; `--dry-run` prints a diff without writing source files.

State and rendering continue through the existing kit: the signals JSX interceptor → `AlgoSection` → `Section` → `createSections`. Values and pins use signals; autosave and named states use the kit's `storageSignal` stores. URL writes, shuffle, reroll, presets, tooltips, drawers and draw-in hooks come from the same components as the existing notebooks.

## 5. Make: a field, an algo, a generator

**Field kinds** (`@hafley66/report-shell`, `src/spec/0_spec.ts`):

| kind | value | extras |
|---|---|---|
| `range` | number slider | `min max step`, `roll: [lo, hi]` shuffle window |
| `number` | number input | `min max step` |
| `seed` | integer input, shuffles to a fresh seed | |
| `select` | string | `options`, `pool` (repeat an option to weight it) |
| `bool` | boolean | `p` true-probability under shuffle |
| `text` | string | `size` |

Every kind takes `label`, `hint` (tooltip first line; the derived facts follow it), `group` (a foldable details in the sidebar), a pin and an individual reroll. Pins are the only shuffle exclusion; text fields supply a `pool`, and numeric fields supply bounds. Hover any control for its tooltip; the e2e test fails on a control without one.

**Algo** (`src/kit/2_algo.ts`): `{ name, spec, presets, run(params, { size, seed, minPx }) -> { paths: [{ d, z?, cls? }], caption, lod[], raw?[] } }` (`raw`: textPath markup rendered after the paths). Drop one into `src/algos/`, then `<AlgoSection page="fractal" algo={myAlgo} sizes={[64, 128, 256]} />` renders a sizes row with LOD captions. `/fractal` is the reference.

**Generator**: a pure function in `src/lib/` that returns SVG path strings (`d`), with `z` in 0..1 for depth. No React, no DOM. `src/lib/eye/` is the reference for a stateful model split into `0_shape`, `1_muscles`, `2_lids`, `3_lashes`, `4_scheduler`.

## 6. Validate

| command | proves |
|---|---|
| `pnpm --filter @hafley66/gothic typecheck` | `tsc --noEmit` clean |
| `pnpm --filter @hafley66/gothic test` | router, pages, FMA, Bash scaffold snapshots, failure cases and generated TypeScript compilation |
| `pnpm --filter @hafley66/gothic test:e2e` | over `dist/index.html` from `file://`: every tab renders svg with zero console errors, tab x identical on every route, a drawer per section, every control titled; edit → shuffle → back restores values; a double-click on shuffle shuffles twice; a named state survives reload; a generated notebook composes Algos, updates geometry and persists signal edits |
| `pnpm --filter @hafley66/gothic check` | all of the above plus `build:single` |

## 7. Where things live

| path | role |
|---|---|
| `src/app/` | page table, router (`loc` signal, history or hash), section state (values + pins signals, URL, autosave), view transitions, `App` |
| `src/ui/` | `useClock`, `Section` (the kit `Section` bound to gothic's section factory: its own sticky, resizable knob sidebar beside the art), `Header` (kit `NavTabs` + page knobs in the end slot), `AlgoSection`, `Raw` |
| `src/kit/` | local Algo contract; shared specs, URL helpers, stores and UI live in `@hafley66/report-shell` |
| `src/pages/` | one module per route exporting `PAGE` |
| `src/lib/`, `src/algos/` | generators and algos, pure |
| `src/lib/legacy/` | the pre-kit single-file notebooks' generators, unchanged, with hand-written `.d.ts` |
| `src/app.css` | Tailwind v4 theme, keyframes, `data-z` depth rule, `@view-transition` |
| `scripts/0_scaffold.sh`, `scripts/templates/` | fixed notebook scaffolding and input templates |
| `tests/*.e2e.test.ts` | existing app and generated-notebook Playwright receipts |

## 8. Rules

`AGENTS.md`: existing generators are never edited without an explicit ask; new behaviour is a new function; old rows in a notebook stay.

## 9. Living reliquaries

Open `/astrolabe` (or `dist/index.html#/astrolabe` in the single-file build).

| section | interaction |
|---|---|
| Astrolabe Monstrance | drag the overlapping brass slit masks; slit count, lobe count, curl and aperture shape the moiré |
| Ribcage Cathedral | play the staggered breathing cycle; drag across the nave; adjust bays, crown opening and delay |
| Mycelial Rose Window | click a petal to seed a growth; filaments extend, anchor and calcify into new stone members |

Each section has the kit's presets, pins, shuffle, URL state and named states. **Hold** records the visible frame in the URL, autosave and selected named state. The scrubber and the two study thumbnails also hold an exact frame. Arrow keys scrub a focused artwork. Motion pauses outside the viewport or in a hidden browser tab; reduced-motion preferences disable autoplay until Play is pressed.

`src/algos/10_astrolabe.ts` through `12_lithic.ts` are pure SVG generators. The rose uses seeded curves with shared forks and exact boundary anchors; one growth cycle subdivides each petal. `src/ui/1_playback.ts` owns ephemeral time signals and the RxJS frame subscription. `src/ui/6_MovingAlgo.tsx` binds this playback to the existing section state and renders the animated stage. These sections were created with `pnpm scaffold`; their insertion markers remain available.

## 10. Reusable slice and FMA studies

The full slice animation toolkit is exported from `@hafley66/gothic/slice`, with `useSlice` at `@hafley66/gothic/slice/react`. [API and renderer examples](src/kit/slice/README.md) cover existing SVGs, path data, signal controls, clocks, seeking and teardown. `/slice` consumes the shared segmentation and poses.

`/fma` keeps its original seal and gallery, then adds chord envelopes, braided ribbons, conformal pole grids, Voronoi cells and standing-wave contours. Each new section has four geometry controls, for 20 additions. Voronoi cells use `d3-delaunay`; contours use `d3-contour`.

Every Gothic field can be pinned and rerolled. Shuffle changes unpinned fields; there is no static column. Text fields use seeded pools and number fields have explicit randomization bounds. The same controls apply to the page-level zDepth and draw-in settings.

## Common controls and reactive animation

[Shared input groups](src/kit/README.md) provide seed, playback, stroke weight, detail and presets. [Slice](src/kit/slice/README.md) exports reusable path timing and SVG binding. Vite enables `signalsJsx()`, so plain components read source signals to activate their streams. The [signals skill](../signals/skills/signals/SKILL.md) records the authoring conventions.
## Property timelines

Each input's ⚙ opens a keyframe table. Enable that input, edit percentage/value rows, then scrub or play the property timeline. Page timing supplies defaults; section and field checkboxes override individual duration, delay, easing, direction and loop values. Field cycles run inside the page timeline. Numeric fields interpolate with anime.js easing and obey the spec's bounds and step; select, text, boolean and seed fields switch at keyframes. `roll values` randomizes the table through the input's existing spec.

The live values are derived signals. Saved inputs, named states and shuffle pins keep their base values. Timeline settings and held position persist separately at `gothic.<page>.timelines` in localStorage. Resetting a field removes its timeline and returns the saved input. The property timeline can drive Slice controls while Slice's stroke clock runs or holds independently.

Slice's `slice weight` controls moving strokes, blades and afterimages; `path weight` controls completed paths. Core presets add iris, opposed blades and rung lattice variants. `core · original` restores the original seal; it remains the default.
