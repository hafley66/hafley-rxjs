import { userEvent } from "vitest/browser"
import { expect, it } from "vitest"
import { sequenceFrame } from "./proof/0_sequenceFrame.ts"
import { createCytoscapeGraphFrameResource } from "./6_graphRenderer.ts"

const frames = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))

it("an armed-mode diagram lets the page scroll until right-click, and a fling never loses the drawing", async () => {
  const frame = await sequenceFrame({ width: 600, height: 300 }, "paired-mermaid")
  const page = document.createElement("div")
  page.style.cssText = "position:fixed;inset:0;overflow:auto"
  const content = document.createElement("div")
  content.style.cssText = "height:4000px;padding-top:100px"
  const host = document.createElement("div")
  host.style.cssText = "position:relative;width:600px;height:300px"
  content.appendChild(host)
  page.appendChild(content)
  document.body.appendChild(page)
  const outside = document.createElement("button")
  content.appendChild(outside)
  const resource = createCytoscapeGraphFrameResource(host, undefined, undefined, { wheel: "armed" })
  try {
    resource.render(frame, { enterIds: Object.keys(frame.graph), updateIds: [], exitIds: [] })
    const camera = () => ({ x: Math.round(resource.cy.pan().x), y: Math.round(resource.cy.pan().y), zoom: Number(resource.cy.zoom().toFixed(3)) })
    const onScreen = () => {
      const box = resource.cy.elements().renderedBoundingBox({})
      return box.x2 > 0 && box.x1 < 600 && box.y2 > 0 && box.y1 < 300
    }
    const trace: Record<string, unknown>[] = []
    const record = (step: string) => trace.push({ step, wheel: host.dataset.graphtWheel, scrollTop: page.scrollTop, camera: camera(), onScreen: onScreen() })
    record("mounted")

    await userEvent.wheel(host, { delta: { y: 50 } })
    await frames()
    record("wheel while passive")

    host.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 300, clientY: 150 }))
    await userEvent.wheel(host, { delta: { y: 20 } })
    await new Promise(resolve => setTimeout(resolve, 700))
    record("small wheel while armed: camera moves, page stays")
    for (let index = 0; index < 40; index++) await userEvent.wheel(host, { delta: { y: 120, x: 120 } })
    await new Promise(resolve => setTimeout(resolve, 700))
    record("40-event fling while armed: camera stops at the clamp, the rest scrolls the page")

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    record("Escape")

    host.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }))
    outside.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))
    record("click outside")

    expect(trace).toMatchInlineSnapshot(`
      [
        {
          "camera": {
            "x": 158,
            "y": 29,
            "zoom": 0.472,
          },
          "onScreen": true,
          "scrollTop": 0,
          "step": "mounted",
          "wheel": "passive",
        },
        {
          "camera": {
            "x": 158,
            "y": 29,
            "zoom": 0.472,
          },
          "onScreen": true,
          "scrollTop": 50,
          "step": "wheel while passive",
          "wheel": "passive",
        },
        {
          "camera": {
            "x": 158,
            "y": -44,
            "zoom": 0.472,
          },
          "onScreen": true,
          "scrollTop": 50,
          "step": "small wheel while armed: camera moves, page stays",
          "wheel": "armed",
        },
        {
          "camera": {
            "x": 16,
            "y": -62,
            "zoom": 0.472,
          },
          "onScreen": true,
          "scrollTop": 220,
          "step": "40-event fling while armed: camera stops at the clamp, the rest scrolls the page",
          "wheel": "armed",
        },
        {
          "camera": {
            "x": 16,
            "y": -62,
            "zoom": 0.472,
          },
          "onScreen": true,
          "scrollTop": 220,
          "step": "Escape",
          "wheel": "passive",
        },
        {
          "camera": {
            "x": 16,
            "y": -62,
            "zoom": 0.472,
          },
          "onScreen": true,
          "scrollTop": 220,
          "step": "click outside",
          "wheel": "passive",
        },
      ]
    `)
  } finally {
    resource.unsubscribe()
    page.remove()
  }
})

it("arming one diagram releases the other", async () => {
  const frame = await sequenceFrame({ width: 300, height: 200 }, "paired-d2")
  const hosts = [0, 1].map(() => {
    const host = document.createElement("div")
    host.style.cssText = "position:relative;width:300px;height:200px"
    document.body.appendChild(host)
    return host
  })
  const resources = hosts.map(host => createCytoscapeGraphFrameResource(host, undefined, undefined, { wheel: "armed" }))
  try {
    for (const resource of resources) resource.render(frame, { enterIds: Object.keys(frame.graph), updateIds: [], exitIds: [] })
    const states = () => hosts.map(host => host.dataset.graphtWheel)
    const trace = [states()]
    resources[0]!.setWheelArmed(true)
    trace.push(states())
    resources[1]!.setWheelArmed(true)
    trace.push(states())
    resources[1]!.setWheelArmed(false)
    trace.push(states())
    expect(trace).toMatchInlineSnapshot(`
      [
        [
          "passive",
          "passive",
        ],
        [
          "armed",
          "passive",
        ],
        [
          "passive",
          "armed",
        ],
        [
          "passive",
          "passive",
        ],
      ]
    `)
  } finally {
    for (const resource of resources) resource.unsubscribe()
    for (const host of hosts) host.remove()
  }
})
