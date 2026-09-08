import { act } from "react"
import { createRoot } from "react-dom/client"
import { describe, expect, it } from "vitest"
import type { MarbleEvent } from "./0_types"
import { createMarbler } from "./1_model"
import { MarblerPanel } from "./2_Marbler"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function event(id: string, name: string, type: string, start: number | null, duration: number | null, children?: MarbleEvent[]): MarbleEvent {
  return {
    id, name, type, start, duration, children,
    method: "SPAN",
    status: 200,
    initiator: "runner",
    size: "0 logs",
    from: "runner",
    to: "suite",
    preview: `preview ${id}`,
    phases: start === null ? [] : [{ kind: "work", start, end: start + (duration ?? 0) }],
  }
}

const child1 = event("child-1", "first child", "tool", 100, 50)
const child2 = event("child-2", "second child", "tool", 400, 120)
const parent = event("parent", "untimed parent", "request", null, null, [child1, child2])
const sibling = event("sibling", "timed sibling", "result", 600, 80)

function bars(host: HTMLElement): Map<string, [number, number]> {
  const raw = host.querySelector(".waterfall-pixi")?.getAttribute("data-bars") ?? ""
  return new Map(raw.split(",").filter(Boolean).map((entry) => {
    const [id, left, right] = entry.split(":")
    return [id, [Number(left), Number(right)]] as const
  }))
}

async function mount(model: ReturnType<typeof createMarbler>) {
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  await act(async () => root.render(<MarblerPanel model={model} />))
  await new Promise((resolve) => setTimeout(resolve, 120))
  return { host, root }
}

describe("aggregate waterfall bars", () => {
  it("draws a parent bar spanning both children when the parent carries no timing", async () => {
    const model = createMarbler([parent, sibling])
    model.selectedId.$(null)
    const { host, root } = await mount(model)
    await expect.poll(() => document.querySelectorAll("canvas.waterfall-canvas").length).toBe(1)

    expect(model.viewport.$().full).toEqual([100, 680])
    await expect.poll(() => bars(host).has("parent")).toBe(true)
    const collapsed = bars(host)
    expect(collapsed.get("parent")?.[0]).toBe(0)
    expect(collapsed.get("parent")?.[1]).toBeGreaterThan(0)

    const toggle = host.querySelector("[data-event-id='parent'] .expand-toggle") as HTMLButtonElement
    await act(async () => toggle.click())
    await new Promise((resolve) => setTimeout(resolve, 60))
    const expanded = bars(host)
    const [parentLeft, parentRight] = expanded.get("parent") ?? [0, 0]
    expect(parentLeft).toBe(expanded.get("child-1")?.[0])
    expect(parentRight).toBe(expanded.get("child-2")?.[1])
    expect(parentRight).toBeGreaterThan(expanded.get("child-1")?.[1] ?? 0)

    const canvas = document.querySelector("canvas.waterfall-canvas") as HTMLCanvasElement
    const bounds = canvas.getBoundingClientRect()
    const midGap = bounds.left + (parentLeft + parentRight) / 2
    await act(async () => canvas.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: midGap, clientY: bounds.top + 10 })))
    expect(model.hoveredId.$()).toBe("parent")

    await act(async () => root.unmount())
    host.remove()
  })

  it("shows the aggregate duration on the parent row with its own duration muted", async () => {
    const narrow = event("narrow", "narrow parent", "request", 100, 20, [child2])
    const model = createMarbler([narrow])
    const { host, root } = await mount(model)
    const cell = host.querySelector("[data-event-id='narrow'] .col-duration") as HTMLElement
    expect(cell.textContent).toBe("420ms20ms")
    expect(cell.querySelector("small")?.textContent).toBe("20ms")
    await act(async () => root.unmount())
    host.remove()
  })
})

describe("flame view", () => {
  it("renders one rect per node at depth-based y and selects on click", async () => {
    const model = createMarbler([parent, sibling])
    model.selectedId.$(null)
    const { host, root } = await mount(model)
    await act(async () => model.view.$("flame"))

    expect(host.querySelector(".grid-scroller")).toBeNull()
    const nodes = Array.from(host.querySelectorAll("[data-node-id]"))
    expect(nodes.map((node) => node.getAttribute("data-node-id"))).toEqual(["parent", "child-1", "child-2", "sibling"])
    const geometry = nodes.map((node) => {
      const rect = node.querySelector("rect") as SVGRectElement
      return [node.getAttribute("data-node-id"), Number(rect.getAttribute("y")), Math.round(Number(rect.getAttribute("width")))]
    })
    expect(geometry.map((entry) => entry[1])).toEqual([1, 23, 23, 1])
    expect(geometry[0][2]).toBeGreaterThan(geometry[1][2] as number)

    const before = nodes.length
    await act(async () => model.view.$("table"))
    const toggle = host.querySelector("[data-event-id='parent'] .expand-toggle") as HTMLButtonElement
    await act(async () => toggle.click())
    await act(async () => model.view.$("flame"))
    expect(host.querySelectorAll("[data-node-id]").length).toBe(before)

    const childNode = host.querySelector("[data-node-id='child-2']") as SVGGElement
    await act(async () => childNode.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })))
    await act(async () => childNode.dispatchEvent(new MouseEvent("click", { bubbles: true })))
    expect(model.selectedId.$()).toBe("child-2")
    await expect.poll(() => host.querySelector("[data-testid='event-details'] b")?.textContent).toBe("second child")

    await act(async () => root.unmount())
    host.remove()
  })

  it("keeps the toggle state on the model and honors the viewport zoom", async () => {
    const model = createMarbler([parent, sibling])
    const { host, root } = await mount(model)
    expect(model.view.$()).toBe("table")
    const flameButton = host.querySelector("[data-testid='view-flame']") as HTMLButtonElement
    await act(async () => flameButton.click())
    expect(model.view.$()).toBe("flame")
    expect(host.querySelector("[data-testid='view-flame']")?.className).toBe("kind active")

    const widthAt = () => Number((host.querySelector("[data-node-id='parent'] rect") as SVGRectElement).getAttribute("width"))
    const full = widthAt()
    await act(async () => model.viewport.$({ ...model.viewport.$(), visible: [100, 390] }))
    expect(widthAt()).toBeGreaterThan(full)

    await act(async () => root.unmount())
    host.remove()
  })
})
