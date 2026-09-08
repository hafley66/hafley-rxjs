import { describe, expect, it } from "vitest"
import { border, corners, plan, rails } from "./7_border.js"

const MASONRY_RAILS = ["brick", "dentil", "chevron", "plinth"] as const
const MASONRY_CORNERS = ["block", "mitre"] as const

describe("masonry border family", () => {
  it("emits straight joints only: no arc or curve commands", () => {
    for (const rail of MASONRY_RAILS) {
      const d = border(960, 540, plan(960, 540, 7, { seed: 7, rail, corner: "mitre", cell: 24, depth: 10 }))
      expect(d, rail).not.toMatch(/[AQC]/)
    }
    for (const corner of MASONRY_CORNERS) {
      const d = border(960, 540, plan(960, 540, 7, { seed: 7, rail: "brick", corner, cell: 24, depth: 10 }))
      expect(d, corner).not.toMatch(/[AQC]/)
    }
  })

  it("auto pools include the masonry motifs", () => {
    const p = plan(960, 540, 1, { seed: 1, rail: "auto", corner: "auto", cell: 24, depth: 10 })
    expect(p.rail.length).toBe(4)
    expect(Object.keys(rails)).toEqual(expect.arrayContaining([...MASONRY_RAILS, "cusp", "plain"]))
    expect(Object.keys(corners)).toEqual(expect.arrayContaining([...MASONRY_CORNERS, "trefoil", "none"]))
  })

  it("every masonry rail ends its last stroke at (L, 0) so the corner joins without a stray line", () => {
    for (const rail of MASONRY_RAILS) {
      const cmds = rails[rail](120, 24, 10).cmds
      const last = cmds[cmds.length - 1]
      const [x, y] = last.p[last.p.length - 1]
      expect([x, y], rail).toEqual([120, 0])
    }
  })
})
