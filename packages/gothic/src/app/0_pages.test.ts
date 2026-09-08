import { describe, expect, it } from "vitest"
import { matchPage, PAGES } from "./0_pages.js"

describe("pages", () => {
  it("one route per notebook, in tab order", () => {
    expect(PAGES.slice(0, 10).map(p => p.id)).toEqual([
      "eye",
      "slice",
      "icons",
      "border",
      "fractal",
      "circles",
      "tiles",
      "arches",
      "frames",
      "fma",
    ])
    expect(new Set(PAGES.map(p => p.id)).size).toBe(PAGES.length)
    expect(new Set(PAGES.map(p => p.path)).size).toBe(PAGES.length)
    for (const page of PAGES) expect(new Set(page.sections).size).toBe(page.sections.length)
    expect(PAGES.map(p => p.path)).toEqual(PAGES.map(p => `/${p.id}`))
  })
  it("matches a path to its page and falls back to the first", () => {
    expect(matchPage("/fractal").id).toBe("fractal")
    expect(matchPage("/arches").id).toBe("arches")
    expect(matchPage("/nope").id).toBe("eye")
  })
  it("declares every section that renders on the page", () => {
    expect(PAGES.find(p => p.id === "icons")?.sections).toEqual(expect.arrayContaining(["icons", "seal"]))
    expect(PAGES.find(p => p.id === "fractal")?.sections).toEqual(
      expect.arrayContaining(["apollonian", "foils", "lsys", "cusping", "hilbert"]),
    )
    expect(PAGES.find(p => p.id === "arches")?.sections).toEqual(
      expect.arrayContaining([
        "families", "spread", "lobes", "anatomy", "rose", "panel", "flamboyant", "pinnacle",
        "vault", "buttress", "bands", "facade", "noisy", "grammar", "grammar2",
      ]),
    )
  })
  it("query keys are namespaced per section", () => {
    const slice = PAGES.find(p => p.id === "slice")
    const m = slice?.route.match("/slice?slice.seed=9&slice.curve=levy")
    expect(m?.matched && m.values).toMatchObject({ "slice.seed": 9, "slice.curve": "levy" })
  })
})
