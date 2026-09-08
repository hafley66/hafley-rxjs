import { expect, it } from "vitest"
import { DEFAULT_TIMING, sampleProperties, type SectionTracks } from "./7_propertyTimeline.js"

it("cascades field timing over section and page values, interpolates numbers, and steps discrete values", () => {
  const spec = {
    radius: { kind: "range", min: 0, max: 10, step: 0.5, default: 2 },
    count: { kind: "range", min: 2, max: 9, default: 5 },
    shape: { kind: "select", options: ["circle", "triangle"], default: "circle" },
    on: { kind: "bool", default: true },
  } as const
  const base = { radius: 2, count: 5, shape: "circle", on: true }
  const section: SectionTracks = { timing: { duration: 1000 }, fields: {
    radius: { enabled: true, timing: { duration: 2000, delay: 500 }, frames: [{ at: 0, value: 0 }, { at: 1, value: 10 }] },
    count: { enabled: true, timing: {}, frames: [{ at: 0, value: 2 }, { at: 1, value: 9 }] },
    shape: { enabled: true, timing: {}, frames: [{ at: 0, value: "circle" }, { at: 0.5, value: "triangle" }] },
    on: { enabled: false, timing: {}, frames: [{ at: 0, value: false }] },
  } }
  expect([0, 250, 500, 1000, 1500, 2500, 3000].map(ms => sampleProperties(base, spec, section, ms, DEFAULT_TIMING))).toMatchSnapshot()
  expect([0, 500, 1000, 1500, 2000, 2500].map(ms => sampleProperties(base, spec, section, ms, { ...DEFAULT_TIMING, direction: "alternate" }))).toMatchSnapshot()
  expect(sampleProperties(base, spec, undefined, 100, DEFAULT_TIMING)).toBe(base)
  expect(base).toEqual({ radius: 2, count: 5, shape: "circle", on: true })
})
