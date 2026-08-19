import { act } from "react"
import { createRoot } from "react-dom/client"
import { describe, expect, it } from "vitest"
import { page } from "vitest/browser"
import { createMarbler, MarblerPanel } from "@hafley66/marbler"
import type { MarbleEvent, MarbleFrame } from "./0_types"
import { createTimeViewport, eventRange } from "./0a_TimeViewport"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function event(
  id: string,
  name: string,
  method: string,
  type: string,
  initiator: string,
  start: number,
  duration: number,
  preview: string,
): MarbleEvent {
  return {
    id, name, method, type, initiator, start, duration, preview,
    status: method === "POST" ? 202 : 200,
    size: `${Math.max(1, Math.round(duration / 37))}.${id.length} kB`,
    from: initiator,
    to: method === "TOOL" ? "web" : "root",
    phases: [
      { kind: "queue", start, end: start + 14 },
      { kind: "send", start: start + 14, end: start + 40 },
      { kind: type === "result" ? "work" : "wait", start: start + 40, end: start + duration - 54 },
      { kind: "receive", start: start + duration - 54, end: start + duration },
    ],
  }
}

const events = [
  event("m-91f2", "spawn research-lane", "POST", "request", "root", 45, 178, "Inventory Chromium Network panel extraction seams"),
  event("m-a4c8", "search component candidates", "TOOL", "tool", "research-lane", 238, 514, "Search HAR waterfall and DevTools component packages"),
  event("m-0d31", "inspect @cloudflare/waterfall", "GET", "tool", "research-lane", 374, 297, "Read package API, license, and render structure"),
  event("m-ec77", "inspect waterfall-tools", "GET", "tool", "research-lane", 512, 621, "Read canvas renderer and embedding API"),
  event("m-129a", "summarize candidates", "POST", "result", "research-lane", 1182, 332, "Cloudflare web component and canvas renderer comparison"),
  event("m-5be0", "spawn source-lane", "POST", "request", "root", 310, 164, "Trace NetworkWaterfallColumn dependencies"),
  event("m-bb42", "read NetworkLogView.ts", "GET", "tool", "source-lane", 528, 462, "Locate data grid, filter, and waterfall ownership"),
  event("m-724d", "dependency map", "POST", "result", "source-lane", 1041, 388, "NetworkDataGridNode → TimeCalculator → WaterfallColumn"),
]

function frame(
  id: string,
  t: number,
  kind: MarbleFrame["kind"],
  direction: MarbleFrame["direction"],
  peer: string | null,
  preview: string,
): MarbleFrame {
  return { id, t, kind, direction, peer, preview, repeat: 1 }
}

describe("Marbler receipts", () => {
  it("emits grid and selected-event PNGs", async () => {
    const model = createMarbler(events)
    model.selectedId.$(null)
    const host = document.createElement("div")
    document.body.append(host)
    const root = createRoot(host)
    await act(async () => root.render(<MarblerPanel model={model} />))
    await expect.poll(() => document.querySelectorAll("canvas.waterfall-canvas").length).toBe(1)
    await expect.poll(() => document.querySelectorAll("canvas[data-testid='time-navigator']").length).toBe(1)
    await new Promise((resolve) => setTimeout(resolve, 100))
    const waterfall = page.getByTestId("waterfall-pixi")

    expect({
      canvases: document.querySelectorAll("canvas.waterfall-canvas").length,
      pixiHosts: document.querySelectorAll(".waterfall-pixi").length,
      phaseNodes: document.querySelectorAll(".waterfall-cell .phase").length,
    }).toMatchInlineSnapshot(`
      {
        "canvases": 1,
        "phaseNodes": 0,
        "pixiHosts": 1,
      }
    `)

    await act(async () => {
      const navigator = document.querySelector("canvas[data-testid='time-navigator']") as HTMLCanvasElement
      const bounds = navigator.getBoundingClientRect()
      const eventX = 190 + ((238 - 45) / (1514 - 45)) * (bounds.width - 190)
      navigator.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: bounds.left + eventX, clientY: bounds.top + 24 }))
    })
    expect(model.hoveredId.$()).toBe("m-a4c8")
    await act(async () => model.hoveredId.$(null))

    await act(async () => {
      const canvas = document.querySelector("canvas.waterfall-canvas") as HTMLCanvasElement
      const bounds = canvas.getBoundingClientRect()
      canvas.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: bounds.left + 180, clientY: bounds.top + 110 }))
    })
    await expect(page.getByTestId("hovered-event")).toHaveTextContent("inspect @cloudflare/waterfall · 297 ms")
    await act(async () => page.getByTestId("marbler").hover({ position: { x: 500, y: 12 } }))
    await act(async () => {
      const rowName = document.querySelector("[data-event-id='m-a4c8'] b") as HTMLElement
      rowName.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
    })
    expect(model.hoveredId.$()).toBe("m-a4c8")
    await expect(page.getByTestId("marbler")).toMatchScreenshot("2_row-hover-highlights-map")
    await act(async () => page.getByTestId("marbler").hover({ position: { x: 500, y: 12 } }))
    await act(async () => model.hoveredId.$(null))

    await expect(page.getByTestId("marbler")).toMatchScreenshot("0_network-grid")
    await act(async () => model.selectedId.$("m-91f2"))
    await expect(page.getByTestId("marbler")).toMatchScreenshot("1_event-details")

    const appended = Array.from({ length: 100 }, (_, index) => event(`append-${index}`, `appended event ${index}`, "GET", "tool", `lane-${index % 5}`, 1600 + index * 12, 40 + index % 80, `Appended event ${index}`))
    await act(async () => {
      const next = [...events, ...appended]
      model.source.$(next)
      model.viewport.$(createTimeViewport(eventRange(next)))
    })
    await expect.poll(() => document.querySelector(".time-navigator")?.getAttribute("data-mark-count")).toBe("108")

    await act(async () => root.unmount())
    host.remove()
  })

  it("indents a subagent row, draws its frame ticks, lists its messages, and hides it on collapse", async () => {
    const childRow: MarbleEvent = {
      ...event("agent-child", "spawn worker turn", "POST", "request", "agent-root", 120, 200, "Worker subagent session"),
      parentId: "agent-root",
      frames: [
        frame("c1", 120, "spawn", "in", "agent-root", "spawned by coordinator"),
        frame("c2", 220, "mail-out", "out", "agent-root", "progress report"),
        frame("c3", 300, "exit", "self", null, "subagent exit"),
      ],
    }
    const rootRow: MarbleEvent = {
      ...event("agent-root", "spawn coordinator", "POST", "request", "root", 45, 400, "Coordinator session"),
      parentId: null,
      frames: [
        frame("f1", 45, "spawn", "out", "agent-child", "spawn subagent"),
        frame("f2", 200, "mail-in", "in", "agent-child", "status update"),
        frame("f3", 380, "result", "self", null, "coordinator turn complete"),
      ],
      children: [childRow],
    }
    const model = createMarbler([rootRow])
    model.selectedId.$(null)
    const host = document.createElement("div")
    document.body.append(host)
    const root = createRoot(host)
    await act(async () => root.render(<MarblerPanel model={model} />))
    await expect.poll(() => document.querySelectorAll("canvas.waterfall-canvas").length).toBe(1)
    await new Promise((resolve) => setTimeout(resolve, 100))

    const expandToggle = document.querySelector("[data-event-id='agent-root'] .expand-toggle") as HTMLButtonElement
    await act(async () => expandToggle.click())
    const childElement = document.querySelector("[data-event-id='agent-child']") as HTMLElement
    expect(childElement.getAttribute("data-depth")).toBe("1")
    const childNameCell = childElement.querySelector(".col-name") as HTMLElement
    expect(childNameCell.style.paddingLeft).toBe("27px")
    const headerCells = Array.from(host.querySelectorAll(".grid-header > .cell")).map((cell) => {
      const rect = cell.getBoundingClientRect()
      return [Math.round(rect.left), Math.round(rect.width)]
    })
    const rootCells = Array.from(host.querySelectorAll("[data-event-id='agent-root'] > .cell")).map((cell) => {
      const rect = cell.getBoundingClientRect()
      return [Math.round(rect.left), Math.round(rect.width)]
    })
    expect(headerCells).toEqual(rootCells)
    expect((host.querySelector(".waterfall-pixi") as HTMLElement).style.left).toBe("710px")
    const timelineBottom = (host.querySelector(".timeline") as HTMLElement).getBoundingClientRect().bottom
    const rootTop = (host.querySelector("[data-event-id='agent-root']") as HTMLElement).getBoundingClientRect().top
    expect(rootTop).toBeGreaterThanOrEqual(timelineBottom)

    await new Promise((resolve) => setTimeout(resolve, 100))
    await expect(page.getByTestId("marbler")).toMatchScreenshot("3_nested-agent-frame-ticks")

    await act(async () => childElement.click())
    await expect.poll(() => document.querySelectorAll("[data-testid='messages-table'] tbody tr").length).toBe(3)
    const messageKinds = Array.from(document.querySelectorAll("[data-testid='messages-table'] tbody tr")).map((row) => row.querySelector("td:nth-child(2)")?.textContent)
    expect(messageKinds).toEqual(["spawn", "mail-out", "exit"])

    await act(async () => expandToggle.click())
    expect(document.querySelector("[data-event-id='agent-child']")).toBeNull()

    await act(async () => root.unmount())
    host.remove()
  })
})
