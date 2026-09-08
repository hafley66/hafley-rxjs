# Reusing slice

The `/slice` notebook uses this module's spec, segmentation and pose functions. Core exports are available at `@hafley66/gothic/slice`; the React hook is at `@hafley66/gothic/slice/react`. These are TypeScript source exports for workspace consumers and bundlers.

## Connect through JSX

```tsx
import { Signal } from "@hafley66/signals"
import { attachSlice, SLICE_DEFAULTS } from "@hafley66/gothic/slice"

const values = Signal({ ...SLICE_DEFAULTS, reveal: "cut" as const })
const animation = attachSlice(null, { params: values, loop: false })

function Drawing() {
  const frame = animation.frame.$()
  return <>
    <button onClick={() => animation.replay()}>replay</button>
    <output>{Math.round(frame.time)}ms</output>
    <svg ref={animation.ref} viewBox="0 0 200 100">
      <path d="M10 50C40 -10 70 110 100 50S160 -10 190 50" />
    </svg>
  </>
}
```

Enable `signalsJsx()` from `@hafley66/signals/vite`. The frame read activates the cold binding and clock after commit. The last reader leaving restores the source SVG and releases resources. There is no application-level subscribe or component effect.

`params` preserves the supplied signal. `runtime` groups its target, playback permission, seek request and revision. `frame` groups live time, active status and the timeline; use nested projections such as `animation.frame.timeline.T.$()`.

- `animation.seek(ms)` pauses and saves the normalized position into `params.time`.
- `animation.replay()` begins at zero, including after reduced-motion initialization.
- `animation.params.order.$("spectral")` edits a control through the existing signal tree.
- `animation.refresh()` rebuilds after external geometry edits.
- `animation.ref(node)` binds a committed DOM node; `null` releases that target.

For a React-owned instance, `useSlice(values, geometryVersion, options)` from `@hafley66/gothic/slice/react` provides stable allocation and a ref callback. Read its `frame` in JSX and pass its `ref` to the SVG. Change `geometryVersion` when React replaces source geometry. Its implementation uses no component effects or manual subscriptions.

`src/ui/1c_SliceStage.tsx` wraps arbitrary SVG children with that hook and the shared transport. FMA and circles use it on every drawing section, with one `timing` namespace per page. `<Section slice>` and `<AlgoSection slice>` opt into that page's timeline. A page using these sections includes `<SliceTiming page={id} />` and `timing: SLICE_SPEC` in its specs. The existing generators receive their original inputs. The header draw-in switch releases Slice overlays and displays the complete SVG when disabled.

`attachSlice` also accepts an already mounted SVG, group, geometry element, element containing SVGs, or an array of SVG geometry elements as its first argument. The binding remains cold until observed.

Paths, circles, ellipses, rectangles, lines, polylines and polygons are supported. Definitions, clip geometry, masks, markers, patterns and symbols are excluded from the animated source set. Text, images, `<use>` instances and opaque Canvas `Path2D` objects are not converted into outlines.

Temporary stroke overlays stay beside each source element, preserving ancestor transforms, clipping and paint order. Filled shapes appear as animated outlines during the reveal; the original returns after its strokes land. Geometry changes require `refresh()` or the React revision argument. Pause independent animations while slice owns a shape.

Reduced motion lands the artwork and pauses. Explicit replay enables motion. Browser-tab hiding releases the frame stream until visible again. The default budget is 12,000 stroke pieces; raise `cut` or pass `maxStrokes` for larger drawings.

## Reuse inputs and presets

Pass `SLICE_SPEC` and `SLICE_PRESETS` to `Section` or `SpecPanel` under the new section's namespace. The existing kit derives pins, reroll, shuffle, URL state and named states. Every field is shuffleable; pins hold chosen values.

For partial panels, compose `SLICE_REVEAL_INPUTS`, `SLICE_CUT_INPUTS`, `SLICE_ORDER_INPUTS`, and `SLICE_FLIGHT_INPUTS`. Seed, stroke weight, playback and common presets come from `@hafley66/gothic/inputs`. `AnimationControls` from `@hafley66/gothic/inputs/react` provides the shared transport.

## Use timing and poses without SVG or React

```ts
import { SLICE_DEFAULTS, slicePaths, slicePose } from "@hafley66/gothic/slice"

const params = { ...SLICE_DEFAULTS, reveal: "draw+slide" as const }
const timeline = slicePaths([
  "m0 0q30 -40 60 0t60 0",
  { d: "M0 0H40V40Z", transform: "translate(150 0) rotate(20)" },
  [[0, 80], [30, 110], [70, 75]],
], params, { size: 240 })

const frames = timeline.strokes.map(stroke => slicePose(stroke, 450, params))
// Each frame provides opacity, affine matrix, SVG transform, dash offset,
// blade path, stroke width and afterimage opacity. A Canvas renderer can
// apply frame.matrix with context.transform(...frame.matrix), then draw
// the corresponding stroke.pts or stroke.d with its own paint settings.
```

`splitPath` normalizes relative and shorthand commands and preserves subpath boundaries. `slicePaths` accepts path strings, `{ d, transform? }` objects and polylines. It returns sampled pieces and their seeded schedule. The existing `schedule`, `CURVES`, `GAPS`, `FLY` and `alongPts` are also exported directly. `sliceClock(values, duration, options)` is the shared playback model, available separately for an existing playback-values signal and a duration in milliseconds or duration observable.

- Orders: sweep, radial, radial-in, path, subpath, golden, golden-angle, van der Corput, spectral, Hilbert, random.
- Timing curves: linear, ease-in, ease-out, ease-in-out, exponential, sine and steps.
- Seeded gaps: white, smooth-N, Fourier, logistic, Lorenz, Poisson, pink, red, blue, violet, gamma and Lévy.
- Reveals: draw, cut, slide, draw+slide and glow, with the original flight easing, overshoot, stretch, blade and afterimage equations.

Path parsing uses [svgpath](https://github.com/fontello/svgpath); arc-length sampling uses [svg-path-properties](https://github.com/rveciana/svg-path-properties). Unit tests exercise the path core without a browser. Browser tests cover mounted geometry, nested groups, clipping, replay, reduced motion and restoration.
