import { describe, expect, it } from "vitest"
import { attachPhantomScrollbar } from "./phantomScrollbar"

function element() {
  return document.createElement("div")
}

// jsdom has no layout engine, so scrollWidth/clientWidth read 0. Simulate the
// scroll extents the primitive reads on the content element.
function simulateExtent(content: HTMLElement, scrollWidth: number, clientWidth: number) {
  Object.defineProperty(content, "scrollWidth", { value: scrollWidth, configurable: true })
  Object.defineProperty(content, "clientWidth", { value: clientWidth, configurable: true })
}

describe("phantomScrollbar", () => {
  it("mirrors content scrollWidth into the sizer and reports overflow", () => {
    const host = element()
    const content = element()
    document.body.append(host, content)
    simulateExtent(content, 1000, 200)
    const flips: boolean[] = []
    const { track } = attachPhantomScrollbar({ host, content, onOverflowChange: (o) => flips.push(o) })
    expect(flips).toEqual([true])
    expect(track.style.display).not.toBe("none")
    const sizer = track.firstElementChild as HTMLElement
    expect(sizer.style.width).toBe("1000px")
  })

  it("hides itself when content does not overflow", () => {
    const host = element()
    const content = element()
    document.body.append(host, content)
    simulateExtent(content, 100, 200)
    const flips: boolean[] = []
    const { track } = attachPhantomScrollbar({ host, content, onOverflowChange: (o) => flips.push(o) })
    expect(flips).toEqual([false])
    expect(track.style.display).toBe("none")
  })

  it("updates the sizer and overflow state when content changes size", () => {
    const host = element()
    const content = element()
    document.body.append(host, content)
    simulateExtent(content, 100, 200)
    const flips: boolean[] = []
    const { track, update } = attachPhantomScrollbar({ host, content, onOverflowChange: (o) => flips.push(o) })
    simulateExtent(content, 500, 200)
    update()
    expect(flips).toEqual([false, true])
    const sizer = track.firstElementChild as HTMLElement
    expect(sizer.style.width).toBe("500px")
    expect(track.style.display).not.toBe("none")
  })

  it("syncs track scroll to content scroll", () => {
    const host = element()
    const content = element()
    document.body.append(host, content)
    simulateExtent(content, 1000, 200)
    const { track } = attachPhantomScrollbar({ host, content })
    track.scrollLeft = 400
    track.dispatchEvent(new Event("scroll"))
    expect(content.scrollLeft).toBe(400)
  })

  it("copies the content's resolved scrollbar styles onto the track", () => {
    const host = element()
    const content = element()
    document.body.append(host, content)
    simulateExtent(content, 1000, 200)
    // jsdom may drop these properties; assert the mirror either way.
    content.style.setProperty("scrollbar-width", "thin")
    content.style.setProperty("scrollbar-color", "rgb(1, 2, 3) rgb(4, 5, 6)")
    const resolved = getComputedStyle(content)
    const { track } = attachPhantomScrollbar({ host, content })
    expect(track.style.scrollbarWidth).toBe(resolved.scrollbarWidth)
    expect(track.style.scrollbarColor).toBe(resolved.scrollbarColor)
  })

  it("dispose removes the track", () => {
    const host = element()
    const content = element()
    document.body.append(host, content)
    simulateExtent(content, 1000, 200)
    const { track, dispose } = attachPhantomScrollbar({ host, content })
    expect(host.contains(track)).toBe(true)
    dispose()
    expect(host.contains(track)).toBe(false)
  })
})