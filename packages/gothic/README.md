# @hafley66/gothic

Procedural gothic line art as one React SPA. Every route is a notebook: a bar of knobs derived from a spec, URL state per section, shuffle with pins, named states, draw-in animation, a shared header with scroll-driven anchors. The point of the package is to study a generator by turning its knobs and to add a new generator in one file.

## TOC

1. Run
2. Routes
3. Study loop: knobs, URL, pins, named states
4. Make: a new page
5. Make: a new field, a new algo, a new generator
6. Validate
7. Where things live
8. Rules

## 1. Run

```bash
pnpm --filter @hafley66/gothic dev            # http://localhost:5173/eye
pnpm --filter @hafley66/gothic build:single   # dist/index.html, opens from file:// (hash routing)
pnpm --filter @hafley66/gothic check          # typecheck + vitest + build:single + playwright smoke
```

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

`/` redirects to `/eye`. The page list is `PAGES` in `src/app/0_pages.ts`; tabs, routes, query schemas and anchors all derive from it.

## 3. Study loop

| action | effect | URL |
|---|---|---|
| move a knob | section re-renders, `replaceState` | `?eye.seed=3&eye.segs=64` |
| shuffle | every unpinned, non-static field rerolls from one seeded rng, `pushState` | same keys, new values |
| pin (box next to a knob) | shuffle skips it; survives reload and back/forward | `?eye.pin=seed,shape` |
| preset select | applies a partial value set, `pushState` | keys it touches |
| save (state name + save) | localStorage `gothic.<page>.<section>.states`, chips with star and delete | none |
| autosave | every change lands in `gothic.<page>.<section>.current`; start order is defaults, then autosave, then URL keys present | none |
| zDepth / draw-in (header) | page-global stroke fade by `data-z`, and draw-in time | `?page.z=0.4&page.draw=false` |

Only non-default values print to the URL. Foreign query keys survive a write. Copying the address bar reproduces the view.

## 4. Make: a new page

One file, one registration.

```tsx
// src/pages/9_rose.tsx
import type { PageSpec } from "../app/0_pages.js"
import type { AnySpec, ValuesOf } from "../kit/0_spec.js"
import { Section } from "../ui/2_Section.js"
import { roseWindow } from "../lib/8_rose.js"          // pure generator: params -> path strings

const SPEC = {
  seed: { kind: "seed", default: 7 },
  petals: { kind: "range", min: 6, max: 24, default: 12, roll: [8, 16] },
  style: { kind: "select", options: ["plain", "foiled"], default: "plain" },
  weight: { kind: "range", min: 0.5, max: 2.5, step: 0.1, default: 1, static: true },
} as const satisfies AnySpec
type V = ValuesOf<typeof SPEC>

function RosePage() {
  return (
    <Section page="rose" def={{ id: "rose", title: "rose", spec: SPEC }}>
      {v => {
        const { paths, caption } = roseWindow(v as V, 320)
        return (
          <figure className="grid justify-items-center gap-1 text-[10px] text-muted">
            <svg viewBox="-160 -160 320 320" width={320} height={320} className="kit-draw">
              {paths.map((d, i) => <path key={i} d={d} pathLength={1} style={{ "--i": i } as never} />)}
            </svg>
            <figcaption>{caption}</figcaption>
          </figure>
        )
      }}
    </Section>
  )
}

export const PAGE: PageSpec = { id: "rose", title: "gothic: rose window", path: "/rose", specs: { rose: SPEC }, Component: RosePage }
```

Then add `rose` to the `PAGES` array in `src/app/0_pages.ts`. Run `pnpm check`: the smoke test walks the new tab.

Several sections on one page: one `Section` per spec, each with its own `id`; list them all in `specs`. Bar-less sections use `PlainSection` and go in `anchors`.

## 5. Make: a field, an algo, a generator

**Field kinds** (`src/kit/0_spec.ts`):

| kind | value | extras |
|---|---|---|
| `range` | number slider | `min max step`, `roll: [lo, hi]` shuffle window |
| `number` | number input | `min max step` |
| `seed` | integer input, shuffles to a fresh seed | |
| `select` | string | `options`, `pool` (repeat an option to weight it) |
| `bool` | boolean | `p` true-probability under shuffle |
| `text` | string | `size` |

Every kind takes `label`, `group` (bar cluster), `static: true` or `shuffle: false` (trailing cluster, no pin).

**Algo** (`src/kit/2_algo.ts`): `{ name, spec, presets, run(params, { size, seed, minPx }) -> { paths: [{ d, z?, cls? }], caption, lod[] } }`. Drop one into `src/algos/`, then `<AlgoSection page="fractal" algo={myAlgo} sizes={[64, 128, 256]} />` renders a sizes row with LOD captions. `/fractal` is the reference.

**Generator**: a pure function in `src/lib/` that returns SVG path strings (`d`), with `z` in 0..1 for depth. No React, no DOM. `src/lib/eye/` is the reference for a stateful model split into `0_shape`, `1_muscles`, `2_lids`, `3_lashes`, `4_scheduler`.

## 6. Validate

| command | proves |
|---|---|
| `pnpm --filter @hafley66/gothic typecheck` | `tsc --noEmit` clean |
| `pnpm --filter @hafley66/gothic test` | vitest over spec, url, store, router, pages |
| `pnpm --filter @hafley66/gothic smoke` | every header tab renders svg with zero console errors, tab x identical on every route, `dist/index.html` works from `file://` |
| `pnpm --filter @hafley66/gothic check` | all of the above plus `build:single` |

## 7. Where things live

| path | role |
|---|---|
| `src/app/` | page table, router (`loc` signal, history or hash), section state (values + pins signals, URL, autosave), view transitions, `App` |
| `src/ui/` | hooks (`useClock`, `useDrawIn`, `useAnchor`), `Bar`, `Section`, `Header`, `AlgoSection`, `Raw` |
| `src/kit/` | framework with no gothic knowledge: spec, url, algo contract, store. `src/kit/README.md` is the contract and the harvest list |
| `src/pages/` | one module per route exporting `PAGE` |
| `src/lib/`, `src/algos/` | generators and algos, pure |
| `src/lib/legacy/` | the pre-kit single-file notebooks' generators, unchanged, with hand-written `.d.ts` |
| `src/app.css` | Tailwind v4 theme, keyframes, `data-z` depth rule, `@view-transition` |
| `scripts/0_smoke.mjs` | the playwright smoke |

## 8. Rules

`AGENTS.md`: existing generators are never edited without an explicit ask; new behaviour is a new function; old rows in a notebook stay.
