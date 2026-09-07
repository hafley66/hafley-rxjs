import { describe, expect, it } from "vitest"
import { HOME, parseHref, toHref } from "./1_router.js"

describe("router", () => {
  it("reads the path and query from a server url", () => {
    expect(parseHref("http://localhost:5173/slice?slice.seed=9", false)).toEqual({
      path: "/slice",
      search: "?slice.seed=9",
    })
    expect(parseHref("http://localhost:5173/", false)).toEqual({ path: HOME, search: "" })
    expect(parseHref("http://localhost:5173/fractal/", false).path).toBe("/fractal")
  })
  it("reads the same url out of the hash for file:// builds", () => {
    expect(parseHref("file:///x/dist/index.html#/eye?eye.seed=4", true)).toEqual({
      path: "/eye",
      search: "?eye.seed=4",
    })
    expect(parseHref("file:///x/dist/index.html", true)).toEqual({ path: HOME, search: "" })
  })
  it("prints hrefs in the mode it is given", () => {
    expect(toHref({ path: "/tiles", search: "?tiles.seed=2" }, false)).toBe("/tiles?tiles.seed=2")
    expect(toHref({ path: "/tiles", search: "?tiles.seed=2" }, true)).toBe("#/tiles?tiles.seed=2")
  })
})
