import { act } from "react"
import { createRoot } from "react-dom/client"
import { describe, expect, it } from "vitest"
import { page } from "vitest/browser"
import type { MarbleEvent } from "./0_types"
import { createMarbler } from "./1_model"
import { MarblerPanel } from "./2_Marbler"

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

describe("Marbler receipts", () => {
  it("emits grid and selected-event PNGs", async () => {
    const model = createMarbler(events)
    model.selectedId.$(null)
    const host = document.createElement("div")
    document.body.append(host)
    const root = createRoot(host)
    await act(async () => root.render(<MarblerPanel model={model} />))

    expect({
      canvases: document.querySelectorAll("canvas.waterfall-canvas").length,
      phaseNodes: document.querySelectorAll(".waterfall-cell .phase").length,
    }).toMatchInlineSnapshot(`
      {
        "canvases": 1,
        "phaseNodes": 0,
      }
    `)

    await expect(page.getByTestId("marbler")).toMatchScreenshot("0_network-grid")
    await act(async () => model.selectedId.$("m-91f2"))
    await expect(page.getByTestId("marbler")).toMatchScreenshot("1_event-details")

    await act(async () => root.unmount())
    host.remove()
  })
})
