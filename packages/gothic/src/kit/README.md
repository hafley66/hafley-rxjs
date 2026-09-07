# kit

Shared notebook framework: a spec drives the bar, the URL, shuffle, pins, named states, draw-in, and the algo contract. Nothing in this directory knows about seals, eyes, or slices.

## TOC

1. Files
2. Spec and derived schema
3. URL namespaces
4. Bar: groups, static cluster, shuffle, pins, presets, named states
5. Section and page
6. Depth contract (data-z / zDepth)
7. Animation: draw-in and clock
8. Algo contract
9. Harvest

## 1. Files

| file | owns |
|---|---|
| `0_spec.ts` | `Field`, `Spec<P>`, `ValuesOf<S>`, zod derivation, `parseValues`, `shuffle`, pins helpers, local `mulberry32` |
| `1_url.ts` | one `@hafley66/path` route per notebook, `parseSearch` / `printSearch` / `mergeSearch`, `bindUrl`, `commit` |
| `2_bar.ts` | sticky bar DOM from a spec: groups, static cluster, shuffle, pin toggles, preset select, readout, named-state chips |
| `3_section.ts` | `page()` header + nav, `section()` = namespace + bar + host + scroll restore + autosave; zDepth control |
| `4_anim.ts` | `stagger()`, `clock()`, `reducedMotion` |
| `5_algo.ts` | `Algo<P>`, `mountAlgo`, `algoSection` |
| `6_store.ts` | localStorage autosave + named states |
| `kit.css` | theme tokens, bars, chips, depth rule, draw-in keyframes |

## 2. Spec and derived schema

```ts
const SPEC = {
  seed: { kind: "seed", default: 3 },
  shape: { kind: "select", options: ["human", "cat"], default: "human", pool: ["cat", "cat", "human"] },
  segs: { kind: "range", min: 8, max: 160, default: 96, roll: [24, 160], group: "lids" },
  auto: { kind: "bool", default: true, p: 0.8 },
  weight: { kind: "range", min: 0.5, max: 2.5, step: 0.1, default: 1, static: true },
  names: { kind: "text", default: "a b", shuffle: false },
} as const satisfies AnySpec
type V = ValuesOf<typeof SPEC>
```

| field key | meaning |
|---|---|
| `kind` | `range`, `number`, `seed`, `select`, `bool`, `text` |
| `static: true` or `shuffle: false` | shuffle never touches it; rendered in the trailing static cluster; no pin toggle |
| `group` | bar cluster label; first-appearance order |
| `roll: [lo, hi]` | shuffle window inside `min..max` (ranges, numbers) |
| `pool` | select shuffle draws uniformly from this list (repeat an option to weight it) |
| `p` | bool shuffle true-probability (default .5) |

Derived, never written twice: `schemaOf(spec)` gives a zod object; `parseValues(spec, raw)` safeParses per key, so a junk value falls to the field default and unknown keys are ignored.

## 3. URL namespaces

```mermaid
flowchart LR
  input[bar input] -->|commit replace| sig[Signal values]
  shuffle[shuffle / preset / chip] -->|commit push| sig
  sig -->|skip first| write[history replace/push]
  pop[popstate] -->|parseSearch| sig
  load[first load] -->|defaults ← autosave ← URL| sig
```

- One route per notebook (`route("/", z.object(shape), z.object({}))`); every key is `<section>.<key>` so `?eye.seed=3&eye.shape=cat&seal.minPx=4` carries several sections.
- Pins travel as `<section>.pin=seed,shape`.
- Only non-default values print. Foreign query keys survive writes.
- `commit("push", fn)` marks the writes inside `fn` as pushState; everything else is replaceState.

## 4. Bar

| element | class | behaviour |
|---|---|---|
| inputs | `[data-key]`, id `kit-<section>-<key>` | `input` event writes the values Signal |
| pin | `.kit-pin[data-pin]` | toggles membership in the section pin set; pinned fields skip shuffle |
| shuffle | `.kit-shuffle` | one seeded rng rolls every non-static, non-pinned field; one push |
| preset | `.kit-preset` | `presets: Record<name, Partial<Values>>`; merges and pushes; shows the matching name |
| readout | `.kit-readout` | non-default values as `k=v`; full list in the title |
| extra | `.kit-extra` | notebook-owned slot (stats, scrub, custom buttons); persists across renders |
| named states | `.kit-states` | name input + save; chips: click name loads (push), star toggles, × deletes |

Inputs with `data-live="1"` are skipped by sync (an animation loop owns them).

## 5. Section and page

```ts
page({ id: "eye", title, links, storage: "gothic" })
const sec = section({ id: "eye", title: "eye", spec: SPEC, presets, zDepth: false, render(values, host, ctx) {} })
```

- `ctx.first` on the initial render, `ctx.changed` = keys that differ from the previous values, `ctx.extra` = bar slot, `ctx.values` = the Signal, `ctx.zDepth`.
- Render runs on every value change; return early on light keys (read `ctx.changed`).
- Scroll: the section's viewport fraction is restored after each render.
- Autosave: every value/pin change writes `<storage>.<page>.<section>.current`; start order is defaults, then autosave, then URL keys present.
- Header: notebook links (`links`, `legacy` gets a `*`), section anchors, zDepth range when any section opts in. `--kit-top` tracks the header height so section bars stick under it.

## 6. Depth contract

- Any element with `data-z="0..1"` (0 near, 1 far) is styled by `kit.css`: `stroke-opacity = 1 - 0.8·z·zDepth`, `stroke-width = --w · (1 - 0.6·z·zDepth)`.
- `zDepth` is the global range in the header (`?page.z=`); 0 = flat. `applyDepth(root)` copies `data-z` into `--z` after each render.
- Sections with `zDepth: true` re-render when zDepth changes and can read `ctx.zDepth`.

## 7. Animation

- Draw-in: give every path `pathLength="1"`, put class `kit-draw` on an ancestor, call `stagger(root)` to number paths with `--i`. Tune with `--kit-ms` and `--kit-stagger`. Reduced motion disables it.
- `clock(frame, { tempo, running })`: rAF loop; `elapsed()` advances only while running, scaled by tempo; `run`, `seek`, `reset`, `stop`; `bindScrub(input, period)` mirrors elapsed into a 0..100 slider and seeks on input.

## 8. Algo contract

```ts
type Algo<P> = {
  name: string
  spec: Spec<P>
  presets: Record<string, Partial<P>>
  run(params: P, ctx: { size: number; seed: number; minPx: number }): { paths: { d: string; z?: number; cls?: string }[]; caption: string; lod: string[] }
}
mountAlgo(algo, host, sizes, params)   // one cell per size: svg + "<size> · caption · lod"
algoSection(algo, sizes, title?)       // section keyed by algo.name, zDepth on
```

`ctx.seed` and `ctx.minPx` come from `params.seed` / `params.minPx` when the spec has them.

## 9. Harvest

Copy these files into another project:

```
kit/0_spec.ts  kit/1_url.ts  kit/2_bar.ts  kit/3_section.ts  kit/4_anim.ts  kit/5_algo.ts  kit/6_store.ts  kit/kit.css  kit/index.ts
```

They need exactly four imports: `@hafley66/path` (`route`), `@hafley66/signals` (`Signal`), `zod`, `rxjs` (`skip`). Everything else is DOM. The CSS import in `3_section.ts` assumes a bundler that accepts `import "./kit.css"`.
