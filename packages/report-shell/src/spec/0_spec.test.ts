import { describe, expect, it } from "vitest"
import {
  type AnySpec,
  defaultsOf,
  isStatic,
  mulberry32,
  parseValues,
  pinSet,
  pinText,
  readout,
  schemaOf,
  shuffle,
  snap,
} from "./0_spec.js"

const spec = {
  seed: { kind: "seed", default: 3 },
  shape: { kind: "select", options: ["human", "cat", "random"], default: "human", pool: ["cat", "random"] },
  segs: { kind: "range", min: 8, max: 160, default: 96, roll: [24, 160] },
  lag: { kind: "range", min: 0, max: 1.5, step: 0.05, default: 0.5 },
  dress: { kind: "bool", default: true, static: true },
  weight: { kind: "range", min: 0.5, max: 2.5, step: 0.1, default: 1, shuffle: false },
  names: { kind: "text", default: "a b", shuffle: false },
} as const satisfies AnySpec

describe("spec", () => {
  it("derives defaults", () => {
    expect(defaultsOf(spec)).toEqual({
      seed: 3,
      shape: "human",
      segs: 96,
      lag: 0.5,
      dress: true,
      weight: 1,
      names: "a b",
    })
  })
  it("static or shuffle:false both count as static", () => {
    expect(isStatic(spec.dress)).toBe(true)
    expect(isStatic(spec.weight)).toBe(true)
    expect(isStatic(spec.seed)).toBe(false)
  })
  it("derives a zod schema that coerces and rejects", () => {
    const s = schemaOf(spec)
    expect(
      s.safeParse({ seed: "4", shape: "cat", segs: "12", lag: 0.1, dress: "false", weight: 2, names: "x" }).data,
    ).toEqual({
      seed: 4,
      shape: "cat",
      segs: 12,
      lag: 0.1,
      dress: false,
      weight: 2,
      names: "x",
    })
    expect(
      s.safeParse({ seed: "nope", shape: "cat", segs: 1, lag: 0, dress: true, weight: 1, names: "" }).success,
    ).toBe(false)
  })
  it("parseValues drops junk per key and keeps the rest", () => {
    expect(parseValues(spec, { seed: "9", shape: "dog", segs: "abc", dress: "0", junk: 1 })).toEqual({
      seed: 9,
      shape: "human",
      segs: 96,
      lag: 0.5,
      dress: false,
      weight: 1,
      names: "a b",
    })
  })
})

describe("shuffle", () => {
  it("snaps to step inside the window", () => {
    expect(snap(0, 1.5, 0.05, 0.333)).toBeCloseTo(0.5, 10)
    expect(snap(24, 160, 1, 1)).toBe(160)
    expect(snap(0.5, 2, 0.1, 0)).toBe(0.5)
  })
  it("rolls every shuffleable field and never a static one", () => {
    const before = defaultsOf(spec)
    let changedSeed = 0
    for (let s = 1; s <= 20; s++) {
      const after = shuffle(spec, before, mulberry32(s))
      expect(after.dress).toBe(before.dress)
      expect(after.weight).toBe(before.weight)
      expect(after.names).toBe(before.names)
      expect(["cat", "random"]).toContain(after.shape)
      expect(after.segs).toBeGreaterThanOrEqual(24)
      expect(after.segs).toBeLessThanOrEqual(160)
      expect(Number.isInteger(after.segs)).toBe(true)
      expect(Math.round(after.lag / 0.05) * 0.05).toBeCloseTo(after.lag, 10)
      if (after.seed !== before.seed) changedSeed++
    }
    expect(changedSeed).toBeGreaterThan(15)
  })
  it("skips pinned fields", () => {
    const before = { ...defaultsOf(spec), seed: 42, shape: "human" as const }
    for (let s = 1; s <= 10; s++) {
      const after = shuffle(spec, before, mulberry32(s), pinSet({ pin: "seed,shape" }))
      expect(after.seed).toBe(42)
      expect(after.shape).toBe("human")
    }
    expect(pinText(new Set(["shape", "seed"]))).toBe("seed,shape")
    expect(pinSet({ pin: "" }).size).toBe(0)
  })
  it("is deterministic per rng seed", () => {
    expect(shuffle(spec, defaultsOf(spec), mulberry32(7))).toEqual(shuffle(spec, defaultsOf(spec), mulberry32(7)))
  })
  it("readout lists only non-defaults", () => {
    expect(readout(spec, defaultsOf(spec))).toBe("defaults")
    expect(readout(spec, { ...defaultsOf(spec), seed: 5, lag: 0.25 })).toBe("seed=5 lag=0.25")
  })
})
