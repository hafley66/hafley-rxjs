import { describe, expect, test } from "vitest"
import { shakeOffsets } from "../src/index.js"

const SEED = 1337
const AMPLITUDE = 24
const FRAMES = 120

describe("shakeOffsets", () => {
  test("is a pure function of the seed", () => {
    const first = shakeOffsets(SEED, AMPLITUDE, FRAMES)
    const second = shakeOffsets(SEED, AMPLITUDE, FRAMES)
    expect(Array.from(first)).toEqual(Array.from(second))
    expect(new Uint8Array(first.buffer)).toEqual(new Uint8Array(second.buffer))
  })

  test("separates seeds", () => {
    const a = shakeOffsets(SEED, AMPLITUDE, FRAMES)
    const b = shakeOffsets(SEED + 1, AMPLITUDE, FRAMES)
    expect(Array.from(a)).not.toEqual(Array.from(b))
  })

  test("returns two floats per frame", () => {
    expect(shakeOffsets(SEED, AMPLITUDE, FRAMES).length).toBe(FRAMES * 2)
    expect(shakeOffsets(SEED, AMPLITUDE, 0).length).toBe(0)
  })

  test("lands the last frame back at rest", () => {
    const offsets = shakeOffsets(SEED, AMPLITUDE, FRAMES)
    expect(offsets[(FRAMES - 1) * 2]).toBe(0)
    expect(offsets[(FRAMES - 1) * 2 + 1]).toBe(0)
  })

  test("stays inside the amplitude envelope", () => {
    const offsets = shakeOffsets(SEED, AMPLITUDE, FRAMES)
    for (const value of offsets) {
      expect(value).toBeGreaterThanOrEqual(-AMPLITUDE)
      expect(value).toBeLessThanOrEqual(AMPLITUDE)
    }
  })

  test("matches the checked-in mulberry32 golden", () => {
    const offsets = shakeOffsets(SEED, AMPLITUDE, FRAMES)
    expect(Array.from(offsets.slice(0, 6))).toEqual([
      -15.148232460021973,
      -14.880516052246094,
      14.902655601501465,
      6.8999433517456055,
      -3.3228185176849365,
      -5.709796905517578,
    ])
  })
})
