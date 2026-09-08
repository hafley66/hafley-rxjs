import { defaultsOf } from "@hafley66/report-shell"
import { describe, expect, it } from "vitest"
import { algoCtx } from "../kit/2_algo.js"
import { ALGO as guilloche } from "./3_guilloche.js"
import { ALGO as tracery } from "./4_architecture.js"
import { ALGO as fanvault } from "./5_fanvault.js"
import { ALGO as buttresses } from "./6_buttresses.js"
import { ALGO as spires } from "./7_spires.js"
import { ALGO as wheel } from "./8_wheel.js"
import { ALGO as cloister } from "./9_cloister.js"

const ALGOS = [guilloche, tracery, fanvault, buttresses, spires, wheel, cloister]

describe("architectural studies", () => {
  it("replays every preset with finite coordinates and bounded depth at icon and notebook sizes", () => {
    const receipt = []
    for (const algo of ALGOS) {
      const defaults = defaultsOf(algo.spec)
      for (const [name, preset] of Object.entries({ defaults: {}, ...algo.presets })) {
        const p = { ...defaults, ...preset }
        for (const size of [64, 160, 480]) {
          const ctx = algoCtx(p, size)
          const out = algo.run(p as never, ctx)
          expect(algo.run(p as never, ctx), `${algo.name}.${name}@${size}`).toEqual(out)
          expect(out.paths.length).toBeGreaterThan(0)
          expect(out.paths.filter(path => !path.d.startsWith("M") || /NaN|Infinity/.test(path.d) || (path.z ?? 0) < 0 || (path.z ?? 0) > 1)).toEqual([])
          if (name === "defaults") receipt.push({ algo: algo.name, size, paths: out.paths.length, caption: out.caption, lod: out.lod })
        }
      }
    }
    expect(receipt).toMatchSnapshot()
  })
})
