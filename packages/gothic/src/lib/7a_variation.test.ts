import { expect, it } from "vitest"
import { mulberry32 } from "./0_rng.js"
import { defaultVariation, distributionSample, DISTRIBUTIONS, resolveVariation, rollDistribution, sampleVariation, variedField } from "./7a_variation.js"

const field = { kind: "range", min: 0.1, max: 3, step: 0.01, default: 1 } as const
const v = { ...defaultVariation(field, 1), min: 0.3, max: 2.4, harmonics: 4 }

it("samples bounded distribution shapes, blends two layers and seeks periodic identities deterministically", () => {
  expect(DISTRIBUTIONS.map(kind => {
    const rng = mulberry32(42), bins = [0, 0, 0, 0, 0]
    for (let i = 0; i < 10000; i++) bins[Math.min(4, Math.floor(distributionSample(kind, rng) * 5))]++
    return [kind, bins]
  })).toMatchSnapshot()
  const receipt = []
  for (const mode of ["harmonic", "drift", "hold"] as const) for (const distribution of DISTRIBUTIONS) {
    const config = { ...v, mode, distribution }
    const samples = [0, 1, 2, 3].map(identity => [0, 333, 999, 1999, 3100].map(t => {
      const value = sampleVariation(config, t, identity)
      expect(sampleVariation(config, t + config.period, identity)).toBeCloseTo(value, 10)
      expect(value).toBeGreaterThanOrEqual(config.min)
      expect(value).toBeLessThanOrEqual(config.max)
      return Number(value.toFixed(4))
    }))
    expect(sampleVariation(config, 999, 2)).toBeCloseTo(samples[2][2], 4)
    expect(sampleVariation(config, 3999.999, 2)).toBeCloseTo(sampleVariation(config, 0, 2), 4)
    expect(samples[0]).not.toEqual(samples[1])
    receipt.push({ mode, distribution, samples })
  }
  expect(receipt).toMatchSnapshot()
  expect(sampleVariation(v, 500, 7)).not.toBe(sampleVariation({ ...v, seed: 8 }, 500, 7))
  expect(sampleVariation({ ...v, mix: 0, depth: 0 }, 500, 7)).not.toBe(sampleVariation({ ...v, mix: 1, depth: 0 }, 500, 7))
  expect(rollDistribution(v, mulberry32(43))).toMatchSnapshot()
})

it("maps the shared signal into numeric steps, booleans and weighted discrete choices", () => {
  const config = { ...v, min: 0, max: 1, mode: "hold" as const, phase: 0, harmonics: 1 }
  const fields = [field, { kind: "bool", default: false } as const,
    { kind: "select", options: ["A", "B"], pool: ["A", "A", "B"], default: "A" } as const,
    { kind: "text", pool: ["one", "two", "three"], default: "one" } as const]
  expect(fields.map(f => [0, 10, 1999, 2000, 3999].map(t => variedField(f, config, t, "input")))).toMatchSnapshot()
  expect(sampleVariation(config, 10)).toBe(sampleVariation(config, 1999))
})

it("requires permission and resolves none, global and cascade without losing inherited defaults", () => {
  const global = { seed: 13, mix: 0.1, distribution: "uniform" as const }
  const section = { mix: 0.4, harmonics: 6 }
  const track = { enabled: true, variation: { mix: 0.9, period: 2000 } }
  expect(["none", "global", "cascade"].map(policy => resolveVariation(field, 1, { ...track, variationPolicy: policy as "none" | "global" | "cascade" }, global, section))).toMatchSnapshot()
  expect(resolveVariation(field, 1, { enabled: true }, global, section)).toBe(undefined)
  expect(resolveVariation(field, 1, { ...track, enabled: false, variationPolicy: "cascade" }, global, section)).toBe(undefined)
  const inherited = resolveVariation(field, 1, { ...track, variation: {}, variationPolicy: "cascade" }, global, section)!
  expect([inherited.seed, inherited.mix, inherited.harmonics, inherited.period]).toEqual([13, 0.4, 6, 4000])
})
