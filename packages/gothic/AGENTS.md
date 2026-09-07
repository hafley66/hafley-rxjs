# packages/gothic

Rules for agents editing this package (user-set 2026-09-07):

- Never change an existing generator or implementation unless the user says so explicitly.
- New behaviour = a new function (copy the closest one and diverge). Old rows in the notebook stay.
- Refactor, merge, or de-duplicate only when the user says "copy", "combine", or "clean" for those functions.
- Keep code tight.

## Layout

| path | role |
|---|---|
| `eye.html`, `slice.html`, `icons.html`, `border.html` | vite entries; each is a tiny shell loading `src/notebooks/<name>.ts` |
| `src/kit/` | shared notebook framework (`src/kit/README.md`); depends only on `@hafley66/path`, `@hafley66/signals`, `zod`, `rxjs`, DOM |
| `src/lib/` | gothic-specific shared code: rng, geometry helpers, `foilRing`, the seal composer |
| `src/notebooks/` | one module per notebook; `0_nav.ts` lists the header links |
| `src/algos/` | `Algo<P>` implementations (`0_seal.ts`) |
| `arches.html`, `circles.html`, `tiles.html`, `index.html` | legacy single-file notebooks, not on the kit; they load `nav.js` (classic script, works from file://) for the shared sticky header: file tabs, section anchors, `--kit-top` offset |

Commands: `pnpm --filter @hafley66/gothic dev` (vite, entries at `/eye.html` etc.), `typecheck`, `test` (vitest over `src/kit`).

## Kit contract

- Specs derive schemas: a notebook declares one `Spec` per section; the zod schema, URL parsing, bar inputs, shuffle, and readout all derive from it. Never write a schema by hand.
- Sections own URL namespaces: section `id` = query prefix (`?eye.seed=3&seal.minPx=4`); pins live at `<id>.pin`. Input = replaceState, shuffle/preset/chip load = pushState, popstate restores.
- Static fields never shuffle: `static: true` or `shuffle: false` puts a field in the trailing static cluster with no pin. Per notebook: `seed` shuffles; `weight`, `tempo`, `run`, `dress`, `ghost`, `pen`, `anim`, `afterimage` are static.
- Pins: any shuffleable field can be pinned in the bar; pinned fields are skipped by shuffle and the pin set survives reload and back/forward.
- Named states: every section autosaves to localStorage (`gothic.<page>.<section>.current`) and offers save-as-name chips with star and delete; the URL wins over the autosave on load.
- Depth: elements carrying `data-z` (0 near .. 1 far) get stroke-opacity and stroke-width scaled by the global `zDepth` range (0 = flat). Sections opt in with `zDepth: true`.
- Algo interface: `{ name, spec, presets, run(params, { size, seed, minPx }) -> { paths[{ d, z?, cls? }], caption, lod[] } }`; `algoSection(algo, sizes)` renders a sizes row with LOD captions. Fractal generators and the seal composer conform to it.
- Kit stays harvestable: no gothic-specific code inside `src/kit`; seal, foilRing, eye anatomy, slice reveal live in `src/lib` or the notebook module.

## Legacy notebooks (not migrated)

- `nav.js` is the single page list; `src/notebooks/0_nav.ts` imports it for the kit header. Add a page there once.

- `arches.html`, `circles.html`, `tiles.html`, `index.html`: single-file, own their state handling. `tiles.html` holds the islamic star / mosaic / blackwork sections split out of circles; the fma composer has no tiling bands.
