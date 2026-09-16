import { describe, expect, it } from "vitest"
import { attachPhantomScrollbar } from "./phantomScrollbar.js"
import { scrollBox, trackHost } from "./scrollFixture.js"

describe("phantomScrollbar", () => {
  it("mirrors content scrollWidth into the sizer and reports overflow", () => {
    const host = trackHost()
    const content = scrollBox("x", 200, 1000)
    const flips: boolean[] = []
    const { track } = attachPhantomScrollbar({ host, content, onOverflowChange: (o) => flips.push(o) })
    expect(flips).toEqual([true])
    expect(track.style.display).not.toBe("none")
    const sizer = track.firstElementChild as HTMLElement
    expect(sizer.style.width).toBe("1000px")
  })

  it("hides itself when content does not overflow", () => {
    const host = trackHost()
    const content = scrollBox("x", 200, 100)
    const flips: boolean[] = []
    const { track } = attachPhantomScrollbar({ host, content, onOverflowChange: (o) => flips.push(o) })
    expect(flips).toEqual([false])
    expect(track.style.display).toBe("none")
  })

  it("updates the sizer and overflow state when content changes size", () => {
    const host = trackHost()
    const content = scrollBox("x", 200, 100)
    const flips: boolean[] = []
    const { track, update } = attachPhantomScrollbar({ host, content, onOverflowChange: (o) => flips.push(o) })
    const inner = content.firstElementChild as HTMLElement
    inner.style.width = "500px"
    update()
    expect(flips).toEqual([false, true])
    const sizer = track.firstElementChild as HTMLElement
    expect(sizer.style.width).toBe("500px")
    expect(track.style.display).not.toBe("none")
  })

  it("syncs track scroll to content scroll", () => {
    const host = trackHost()
    const content = scrollBox("x", 200, 1000)
    const { track } = attachPhantomScrollbar({ host, content })
    track.scrollLeft = 400
    track.dispatchEvent(new Event("scroll"))
    expect(content.scrollLeft).toBe(400)
  })

  it("copies the content's resolved scrollbar styles onto the track", () => {
    const host = trackHost()
    const content = scrollBox("x", 200, 1000)
    content.style.setProperty("scrollbar-width", "thin")
    content.style.setProperty("scrollbar-color", "rgb(1, 2, 3) rgb(4, 5, 6)")
    const resolved = getComputedStyle(content)
    const { track } = attachPhantomScrollbar({ host, content })
    expect(track.style.scrollbarWidth).toBe(resolved.scrollbarWidth)
    expect(track.style.scrollbarColor).toBe(resolved.scrollbarColor)
  })

  it("dispose removes the track", () => {
    const host = trackHost()
    const content = scrollBox("x", 200, 1000)
    const { track, dispose } = attachPhantomScrollbar({ host, content })
    expect(host.contains(track)).toBe(true)
    dispose()
    expect(host.contains(track)).toBe(false)
  })
})
