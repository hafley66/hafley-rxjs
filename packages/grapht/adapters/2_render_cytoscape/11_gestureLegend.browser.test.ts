import { userEvent } from "@vitest/browser/context"
import { describe, expect, it } from "vitest"
import { firstValueFrom } from "rxjs"
import { createGestureLegend, DOCUMENT_GESTURES } from "../../src/2_graph/14_gestureLegend.ts"
import { createDocumentGraphFrameResource } from "./8_documentRenderer.ts"

const mount = () => {
  const host = document.createElement("div")
  host.style.cssText = "position:relative;width:600px;height:400px"
  document.body.appendChild(host)
  return { host, legend: createGestureLegend(host) }
}

describe("gesture legend", () => {
  it("sits in the bottom right corner of its host, closed", () => {
    const { host, legend } = mount()
    try {
      const hostBox = host.getBoundingClientRect()
      const legendBox = legend.element.getBoundingClientRect()
      expect(hostBox.right - legendBox.right).toBeLessThan(20)
      expect(hostBox.bottom - legendBox.bottom).toBeLessThan(20)
      expect(legend.element.getAttribute("data-open")).toBe("false")
      expect(getComputedStyle(legend.element.querySelector("dl") as Element).display).toBe("none")
    } finally {
      legend.remove()
      host.remove()
    }
  })

  it("names every gesture the document renderer answers", () => {
    const { host, legend } = mount()
    try {
      const rows = [...legend.element.querySelectorAll("dt")].map(term => term.textContent)
      expect(rows).toEqual(DOCUMENT_GESTURES.map(hint => hint.gesture))
      expect(rows).toContain("shift + scroll")
      expect(rows).toContain("cmd + scroll")
    } finally {
      legend.remove()
      host.remove()
    }
  })

  it("reports a toggle and shows the table once the application pins it", async () => {
    const { host, legend } = mount()
    try {
      const button = legend.element.querySelector("button") as HTMLButtonElement
      const next = firstValueFrom(legend.toggled$)
      button.click()
      expect(await next).toBe(true)
      legend.setOpen(true)
      expect(getComputedStyle(legend.element.querySelector("dl") as Element).display).toBe("grid")
      expect(button.getAttribute("aria-expanded")).toBe("true")
    } finally {
      legend.remove()
      host.remove()
    }
  })

  it("takes a click while the renderer owns the same host", async () => {
    const host = document.createElement("div")
    host.style.cssText = "position:relative;width:600px;height:400px"
    document.body.appendChild(host)
    const resource = createDocumentGraphFrameResource(host)
    try {
      const button = host.querySelector("[data-legend-toggle]") as HTMLButtonElement
      const next = firstValueFrom(resource.legend.toggled$)
      await userEvent.click(button)
      expect(await next).toBe(true)
    } finally {
      resource.unsubscribe()
      host.remove()
    }
  })

  it("does not start a pan when the gesture begins on the legend", () => {
    const host = document.createElement("div")
    host.style.cssText = "position:relative;width:600px;height:400px"
    document.body.appendChild(host)
    const resource = createDocumentGraphFrameResource(host)
    try {
      resource.applyCamera({ x: 0, y: 0, scale: 1, viewport: { x: 0, y: 0, width: 600, height: 400 } })
      const captured: number[] = []
      host.setPointerCapture = (id: number) => captured.push(id)
      const button = host.querySelector("[data-legend-toggle]") as HTMLButtonElement
      const at = { bubbles: true, pointerId: 7, button: 0, clientX: 500, clientY: 350 }
      button.dispatchEvent(new PointerEvent("pointerdown", at))
      expect(captured).toEqual([])
      host.dispatchEvent(new PointerEvent("pointerdown", { ...at, clientX: 100, clientY: 100 }))
      expect(captured).toEqual([7])
    } finally {
      resource.unsubscribe()
      host.remove()
    }
  })
})
