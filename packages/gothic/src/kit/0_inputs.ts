import type { AnySpec, Presets, ValuesOf } from "@hafley66/report-shell"

// Spread a group into a section spec. Override an individual descriptor after the spread.
export const SEED_INPUTS = {
  seed: { kind: "seed", hint: "repeatable geometry and random choices", default: 7 },
} as const satisfies AnySpec

export const PLAYBACK_INPUTS = {
  time: { kind: "range", label: "time", hint: "saved position in the motion cycle; scrubbing holds a frame", min: 0, max: 1, step: 0.001, default: 0.24, group: "playback" },
  speed: { kind: "range", label: "tempo", hint: "playback speed multiplier", min: 0.1, max: 2, step: 0.1, default: 0.6, group: "playback" },
  run: { kind: "bool", label: "play", hint: "advance the animation clock", default: true, group: "playback" },
} as const satisfies AnySpec
export type PlaybackParams = ValuesOf<typeof PLAYBACK_INPUTS>
export const PLAYBACK_PRESETS = {
  "motion · slow": { speed: 0.2, run: true },
  "motion · steady": { speed: 1, run: true },
  "motion · fast": { speed: 1.8, run: true },
  "frame · start": { time: 0, run: false },
  "frame · middle": { time: 0.5, run: false },
  "frame · end": { time: 1, run: false },
} as const satisfies Presets<PlaybackParams>

export const STROKE_INPUTS = {
  weight: { kind: "range", hint: "stroke width multiplier", min: 0.4, max: 2.5, step: 0.1, default: 1 },
} as const satisfies AnySpec
export const STROKE_PRESETS = {
  "ink · fine": { weight: 0.5 },
  "ink · regular": { weight: 1 },
  "ink · bold": { weight: 2 },
} as const satisfies Presets<ValuesOf<typeof STROKE_INPUTS>>

export const DETAIL_INPUTS = {
  minPx: { kind: "range", hint: "smallest visible feature, in pixels", min: 1, max: 6, step: 0.5, default: 2 },
} as const satisfies AnySpec
export const DETAIL_PRESETS = {
  "detail · fine": { minPx: 1 },
  "detail · coarse": { minPx: 4 },
} as const satisfies Presets<ValuesOf<typeof DETAIL_INPUTS>>
