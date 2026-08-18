import { describe, expect, it } from "vitest"
import { syncScroll } from "./scrollSync"

function element() {
  return document.createElement("div")
}

function scrollOn(el: HTMLElement, value: number, key: "scrollLeft" | "scrollTop" = "scrollLeft") {
  el[key] = value
  el.dispatchEvent(new Event("scroll"))
}

describe("syncScroll", () => {
  it("mirrors source scrollLeft onto target on the x axis", () => {
    const source = element()
    const target = element()
    document.body.append(source, target)
    const dispose = syncScroll(source, target, { axis: "x" })
    scrollOn(source, 120)
    expect(target.scrollLeft).toBe(120)
    dispose()
  })

  it("value-guards writes so echoes never ping-pong", () => {
    const source = element()
    const target = element()
    document.body.append(source, target)
    syncScroll(source, target, { axis: "x", bidirectional: true })
    scrollOn(source, 50)
    expect(target.scrollLeft).toBe(50)
    scrollOn(target, 90)
    expect(source.scrollLeft).toBe(90)
    // An echo of the last written value is a no-op and propagates nowhere.
    scrollOn(source, 90)
    expect(target.scrollLeft).toBe(90)
    // A genuinely new value still propagates.
    scrollOn(source, 30)
    expect(target.scrollLeft).toBe(30)
  })

  it("supports the y axis", () => {
    const source = element()
    const target = element()
    document.body.append(source, target)
    syncScroll(source, target, { axis: "y" })
    scrollOn(source, 77, "scrollTop")
    expect(target.scrollTop).toBe(77)
  })

  it("dispose removes listeners", () => {
    const source = element()
    const target = element()
    document.body.append(source, target)
    const dispose = syncScroll(source, target, { axis: "x" })
    dispose()
    scrollOn(source, 200)
    expect(target.scrollLeft).toBe(0)
  })
})
