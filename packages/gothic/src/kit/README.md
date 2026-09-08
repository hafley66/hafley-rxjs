# Notebook kit

The shared `@hafley66/report-shell` spec derives inputs, URL state, shuffle, pins, presets, named states and section drawers. Gothic binds it to its router through `src/app/2_state.ts`.

| module | exports |
|---|---|
| `0_inputs.ts` | shared seed, playback, stroke and detail input groups and presets |
| `1_browser.ts` | cold document visibility and viewport streams |
| `1a_playback.ts` | shared observable-backed playback model |
| `2_algo.ts` | `Algo`, `AlgoOut`, `algoCtx` |
| `3_motion.ts` | compatibility export of the shared playback spec |
| `slice/` | path segmentation, schedules, poses and reactive SVG bindings |

## Compose common inputs

```ts
import { PLAYBACK_INPUTS, PLAYBACK_PRESETS, SEED_INPUTS } from "@hafley66/gothic/inputs"

const SPEC = {
  ...SEED_INPUTS,
  ...PLAYBACK_INPUTS,
  speed: { ...PLAYBACK_INPUTS.speed, max: 3, default: 1 },
  petals: { kind: "range", min: 3, max: 24, default: 8 },
} as const satisfies AnySpec

const presets = {
  ...PLAYBACK_PRESETS,
  rose: { petals: 12, time: 0.5, run: false },
}
```

`STROKE_INPUTS`/`STROKE_PRESETS` provide weight; `DETAIL_INPUTS`/`DETAIL_PRESETS` provide `minPx`. Compose groups that the generator or renderer consumes. Local descriptors can override defaults, ranges, hints or grouping without duplicating the rest of the field definition.

`SLICE_SPEC` and `SLICE_PRESETS` provide the complete path-animation panel. Its reveal, cut, order and flight groups are exported separately. See [slice/README.md](slice/README.md).

`AnimationControls` from `@hafley66/gothic/inputs/react` provides play/pause, seek, hold and restart. Slice and the moving artworks use it. Presets use the existing section preset dropdown; saved custom states use its state combobox.

## State and randomization

- One section owns one namespace: `?<section>.<key>=`; pins use `<section>.pin=a,b`.
- Inputs replace history; shuffle, reroll, preset and saved-state selection push history. Foreign query keys survive writes.
- Initial values merge defaults, local autosave and present URL keys. Back/forward restores state.
- Geometry fields have a pin and reroll. Playback and variation configuration use `static: true`; these stay visible above the drawer and survive shuffle. Every input label carries its descriptor tooltip.
- Numeric fields require bounds. `roll` narrows the shuffle window. Text fields require a `pool`; select pools can weight choices by repetition. Bool `p` sets its shuffle probability.
- Named states use `state.save(name)`. Edits update the selected state and autosave.

## Reactive rendering

Vite enables `signalsJsx()`. Plain JSX components read signals with `.$()`; the interceptor tracks those reads and manages their subscriptions. Related runtime fields share a root and use nested path proxies. See the shipped [signals skill](../../../signals/skills/signals/SKILL.md).

The playback model consumes an existing values signal and a duration in milliseconds or duration observable. It exposes one grouped `runtime` and one `frame` source signal. Reading `frame` in JSX activates its clock; dropping the last reader releases it. Visibility, pause, one-shot completion and replacement are RxJS stream behavior. Live frames remain ephemeral; explicit hold/seek writes the section's saved `time`.

Native SVG bindings use cold sources and `finalize` for restoration. Components provide stable ref callbacks and read output signals. No component effect or manual subscription is needed for the animation graph.

## Add a notebook

Use the literal Bash scaffolder:

```sh
pnpm scaffold page rose
pnpm scaffold input rose petals range
pnpm scaffold section rose braid_study
pnpm scaffold use rose existing_seal 0_seal:sealAlgo
```

Edit the emitted spec and generator, compose common input groups where needed, then run `pnpm check`. Generators remain pure; `AlgoSection` supplies the standard panel and SVG cells. Each new section has its own state namespace.

## Property variation

The page transport controls property animation. Each section has an always-visible property selector, inheritance policy, harmonic/drift/steps actions, settings and separate sample/distribution rerolls. Playback fields and this option set survive geometry shuffle.

- **None** is the initial policy. Global or section defaults do not turn it on.
- **Allow global** uses the page option set, ignoring section and field overrides.
- **Allow cascade** applies page defaults, section overrides, then field overrides. Unchecking a setting inherits it again.

The Global variation and Section variation popovers edit the parent sets. A property's settings combine the existing keyframe table with optional variation. Distribution controls mix normal, uniform, triangular, arcsine and exponential targets; depth varies their mixture and harmonic amplitude. Integer harmonics and independent phases are deterministic per identity. Drift interpolates random targets smoothly; steps holds each target. The same time, seed and identity give the same result regardless of frame order. Normal is clipped at three standard deviations; exponential is capped at four. Distributions describe targets/amplitudes, not the histogram of interpolated frames.

Numeric bounds and step come from the input spec. Bool/select/text inputs sample choices; a text field's pool supplies its available strings. Each variation period runs within the page timeline; set page duration to a common multiple of field periods for seamless combined loops. Explicit holds and seeks reproduce the same samples.

Slice appearance properties offer whole-input or each-stroke scope: weight, finalWeight, ailen, aiOpacity, aiFade, stretch and os. Persistent options live in `gothic.<page>.timelines`; live frames never write saved geometry values or pins.
