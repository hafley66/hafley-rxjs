import { afterEach, describe, expect, it } from "vitest"
import { enableTips } from "./tips"
import "../kit.css"

let disable: (() => void) | null = null
afterEach(() => {
  disable?.()
  disable = null
  document.body.replaceChildren()
})

describe("enableTips", () => {
  it("opens one non-interactive hint over a titled element and restores the title on leave", async () => {
    disable = enableTips()
    const el = document.createElement("span")
    el.title = "cut px\nstroke length in px"
    el.textContent = "hover me"
    document.body.append(el)
    el.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }))
    await new Promise(r => setTimeout(r, 200))
    const tip = document.querySelector(".kit-tip") as HTMLElement
    expect(tip.matches(":popover-open")).toBe(true)
    expect(tip.textContent).toContain("stroke length in px")
    expect(getComputedStyle(tip).pointerEvents).toBe("none")
    expect(el.title).toBe("")
    el.dispatchEvent(new PointerEvent("pointerout", { bubbles: true, relatedTarget: document.body }))
    expect(el.title).toBe("cut px\nstroke length in px")
    expect(tip.matches(":popover-open")).toBe(false)
  })

  it("ignores untitled elements", async () => {
    disable = enableTips()
    const el = document.createElement("span")
    el.textContent = "no title"
    document.body.append(el)
    el.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }))
    await new Promise(r => setTimeout(r, 200))
    expect(document.querySelector(".kit-tip")?.matches(":popover-open")).toBe(false)
  })
})
