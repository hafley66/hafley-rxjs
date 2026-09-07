import { describe, expect, it } from "vitest"
import { matchPage, PAGES } from "./0_pages.js"

describe("pages", () => {
  it("one route per notebook, in tab order", () => {
    expect(PAGES.map(p => p.id)).toEqual([
      "eye",
      "slice",
      "icons",
      "border",
      "fractal",
      "circles",
      "tiles",
      "arches",
      "frames",
    ])
    expect(PAGES.map(p => p.path)).toEqual(PAGES.map(p => `/${p.id}`))
  })
  it("matches a path to its page and falls back to the first", () => {
    expect(matchPage("/fractal").id).toBe("fractal")
    expect(matchPage("/arches").id).toBe("arches")
    expect(matchPage("/nope").id).toBe("eye")
  })
  it("declares every section that renders on the page", () => {
    expect(PAGES.find(p => p.id === "icons")?.sections).toEqual(["icons", "seal"])
    expect(PAGES.find(p => p.id === "fractal")?.sections).toEqual(["apollonian", "foils", "lsys", "cusping", "hilbert"])
    expect(PAGES.find(p => p.id === "arches")?.sections.length).toBe(15)
  })
  it("query keys are namespaced per section", () => {
    const slice = PAGES.find(p => p.id === "slice")
    const m = slice?.route.match("/slice?slice.seed=9&slice.curve=levy")
    expect(m?.matched && m.values).toMatchObject({ "slice.seed": 9, "slice.curve": "levy" })
  })
})
