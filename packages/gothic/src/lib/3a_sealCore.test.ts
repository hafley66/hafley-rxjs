import { createHash } from "node:crypto"
import { expect, it } from "vitest"
import { seal } from "./3_seal.js"
import { sliceSeal, type CoreParams } from "./3a_sealCore.js"
import { slicePaths } from "./6a_slicePaths.js"

it("preserves every original seal part and gives new cores deterministic finite paths", () => {
  const p: CoreParams = { core: "original", coreSides: 5, coreSize: 0.34, coreTurn: 18, coreFrame: "open" }
  const receipts = []
  for (const size of [32, 48, 64, 96, 160, 240]) for (const seed of [1, 7, 501470]) {
    const radius = size / 2 - 2
    const original = seal(radius, seed, { kFirst: true, pupil: false })
    const preserved = sliceSeal(radius, seed, p)
    expect([preserved.sc.parts, preserved.sc.raw, preserved.sc.lod, preserved.s]).toEqual([original.sc.parts, original.sc.raw, original.sc.lod, original.s])
    for (const core of ["iris", "blades", "lattice"] as const) {
      const out = sliceSeal(radius, seed, { ...p, core })
      const timeline = slicePaths(out.sc.parts, {}, { size })
      expect(timeline.strokes.every(s => s.pts.every(point => point.every(Number.isFinite)))).toBe(true)
      expect(out.sc.raw).toEqual([])
      receipts.push([size, seed, core, out.sc.parts.length, createHash("sha256").update(JSON.stringify(out.sc.parts)).digest("hex").slice(0, 12)])
    }
  }
  expect(receipts).toMatchSnapshot()
})
