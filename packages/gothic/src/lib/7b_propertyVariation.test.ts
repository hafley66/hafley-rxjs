import { expect, it } from "vitest"
import { DEFAULT_TIMING, sampleProperties, type SectionTracks } from "./7_propertyTimeline.js"
import { defaultVariation } from "./7a_variation.js"
import { sampleVariedProperties } from "./7b_propertyVariation.js"

it("preserves keyframe sampling and saved inputs while selecting whole-input variation independently of stroke tracks", () => {
  const spec = { weight: { kind: "range", min: 0.1, max: 3, step: 0.1, default: 1 } } as const
  const base = { weight: 1 }
  const section: SectionTracks = { timing: {}, fields: { weight: { enabled: true, timing: {}, frames: [{ at: 0, value: 1 }, { at: 1, value: 2 }] } } }
  for (const t of [0, 500, 999, 2000, 4000]) expect(sampleVariedProperties(base, spec, section, t, DEFAULT_TIMING)).toEqual(sampleProperties(base, spec, section, t, DEFAULT_TIMING))
  section.fields.weight.variation = defaultVariation(spec.weight, 1)
  expect([0, 500, 999, 2000].map(t => sampleVariedProperties(base, spec, section, t, DEFAULT_TIMING))).toMatchSnapshot()
  section.fields.weight.variation.scope = "stroke"
  expect(sampleVariedProperties(base, spec, section, 1000, DEFAULT_TIMING)).toBe(base)
  section.fields.weight.enabled = false
  expect(sampleVariedProperties(base, spec, section, 1000, DEFAULT_TIMING)).toBe(base)
  expect(base).toEqual({ weight: 1 })
})
