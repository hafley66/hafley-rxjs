import { expect, it } from "vitest"
import { Subject } from "rxjs"
import { GRAPH_STYLES } from "../../src/lib/0_graphStyle.js"
import { svgFrame } from "../../src/2_graph/21_svgFrame.js"
import { collapseSequenceFrame } from "../../src/2_graph/18_sequenceCollapse.js"
import { createDocumentGraphFrameResource } from "./8_documentRenderer.ts"
import { createCytoscapeGraphFrameResource } from "./6_graphRenderer.ts"
import { sequenceFrame } from "./proof/0_sequenceFrame.ts"

it("interpolates endpoint hue and alpha in both directions, including native Canvas gradient stops", () => {
  const host = document.createElement("div")
  host.style.cssText = "position:relative;width:600px;height:300px"
  document.body.appendChild(host)
  const frame = svgFrame(document, {
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><defs><marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 Z"/></marker></defs><rect id="a" x="10" y="10" width="40" height="40"/><rect id="b" x="210" y="10" width="40" height="40"/><path id="ab" d="M50 30 L210 30" fill="none" marker-end="url(#arrow)"/><path id="ba" d="M210 40 L50 40" fill="none"/></svg>',
    locator: "gradient.svg", viewport: { width: 600, height: 300 },
    graph: {
      a: { id: "a", type: "node" }, b: { id: "b", type: "node" },
      ab: { id: "ab", type: "edge", fromId: "a", toId: "b", direction: "forward" },
      ba: { id: "ba", type: "edge", fromId: "b", toId: "a", direction: "forward" },
    },
    bindings: [
      { elementId: "a", graphId: "a", role: "actor-shape", ordinal: 0 }, { elementId: "b", graphId: "b", role: "actor-shape", ordinal: 0 },
      { elementId: "ab", graphId: "ab", role: "message-line", ordinal: 0 }, { elementId: "ba", graphId: "ba", role: "message-line", ordinal: 0 },
    ],
  })
  const hops = { a: 1, b: 3, ab: 2, ba: 2 }
  const doc = createDocumentGraphFrameResource(host)
  doc.render(frame, { enterIds: [], updateIds: [], exitIds: [] })
  const original = host.querySelector<SVGElement>("#ab")!.style.cssText
  for (const mode of ["fade", "color"] as const) {
    doc.applyTheme({ ...GRAPH_STYLES.dark, hopMode: mode })
    for (let i = 0; i < 3; i++) doc.applyHover!(hops)
    const gradients = [...host.querySelectorAll("linearGradient")]
    expect(gradients.map(gradient => ({
      axis: [gradient.getAttribute("x1"), gradient.getAttribute("x2")],
      stops: [...gradient.children].map(stop => [stop.getAttribute("stop-color"), stop.getAttribute("stop-opacity")]),
    }))).toEqual([
      { axis: ["50", "210"], stops: [[mode === "fade" ? "#fbbf24" : "#38bdf8", "1"], [mode === "fade" ? "#fbbf24" : "#fb923c", "0.30250000000000005"]] },
      { axis: ["210", "50"], stops: [[mode === "fade" ? "#fbbf24" : "#fb923c", "0.30250000000000005"], [mode === "fade" ? "#fbbf24" : "#38bdf8", "1"]] },
    ])
    expect(host.querySelectorAll("[data-hover-gradients] marker").length).toBe(1)
  }
  doc.applyHover!({})
  expect(host.querySelectorAll("[data-hover-gradients]").length).toBe(0)
  expect(host.querySelector<SVGElement>("#ab")!.style.cssText).toBe(original)
  doc.unsubscribe()

  const native = createCytoscapeGraphFrameResource(host)
  try {
    native.render(frame, { enterIds: [], updateIds: [], exitIds: [] })
    const camera = { zoom: native.cy.zoom(), pan: native.cy.pan() }
    const edge = native.cy.edges().filter(edge => edge.data("graphId") === "ab").first()
    for (const mode of ["fade", "color"] as const) {
      native.applyTheme({ ...GRAPH_STYLES.dark, hopMode: mode })
      native.applyHover!(hops)
      const stops: [number, string][] = []
      const renderer = (native.cy as any).renderer()
      renderer.createGradientStyleFor({ createLinearGradient: () => ({ addColorStop: (at: number, color: string) => stops.push([at, color]) }) }, "line", edge, "linear-gradient", 1)
      expect(stops).toEqual([[0, mode === "fade" ? "rgba(251,191,36,1)" : "rgba(56,189,248,1)"], [1, mode === "fade" ? "rgba(251,191,36,0.30250000000000005)" : "rgba(251,146,60,0.30250000000000005)"]])
      expect(edge.style("line-fill")).toBe("linear-gradient")
    }
    native.applyHover!({})
    expect(edge.style("line-fill")).toBe("solid")
    expect({ zoom: native.cy.zoom(), pan: native.cy.pan() }).toEqual(camera)
  } finally { native.unsubscribe(); host.remove() }
})

it("sticky actor/group headers emit their graph IDs and expose reversible keyboard collapse", async () => {
  const frame = await sequenceFrame({ width: 1280, height: 800 })
  const host = document.createElement("div")
  host.style.cssText = "position:relative;width:1280px;height:800px"
  document.body.appendChild(host)
  for (const create of [createDocumentGraphFrameResource, createCytoscapeGraphFrameResource]) {
    const focusInput$ = new Subject<ReadonlySet<string>>(), collapseInput$ = new Subject<string>()
    const focus: string[][] = [], collapsed: string[] = []
    const subscriptions = [focusInput$.subscribe(ids => focus.push([...ids])), collapseInput$.subscribe(id => collapsed.push(id))]
    const resource = create(host, { cameraInput$: new Subject(), selectionInput$: new Subject(), focusInput$, collapseInput$ }, { inset: 44 })
    try {
      resource.render(frame, { enterIds: [], updateIds: [], exitIds: [] })
      const actor = host.querySelector<SVGGElement>("[data-sticky-ribbon] [data-sticky-id]")!
      const button = host.querySelector<SVGGElement>("[data-sticky-collapse]")!
      const group = button.closest<SVGGElement>("[data-sticky-id]")!
      for (const control of host.querySelectorAll<SVGGElement>("[data-sticky-collapse]")) {
        const bounds = control.getBoundingClientRect()
        const hit = document.elementFromPoint(bounds.x + 11, bounds.y + 11)
        expect(hit?.closest<SVGGElement>("[data-sticky-collapse]")?.dataset.stickyCollapse).toBe(control.dataset.stickyCollapse)
      }
      actor.dispatchEvent(new PointerEvent("pointerenter"))
      actor.dispatchEvent(new PointerEvent("pointerleave"))
      group.dispatchEvent(new PointerEvent("pointerenter"))
      resource.applyHover!({ [actor.dataset.stickyId!]: 3, [group.dataset.stickyId!]: 1 })
      expect([actor.style.opacity, group.style.opacity]).toEqual(["0.3025", "1"])
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      const id = group.dataset.stickyId!
      resource.render(collapseSequenceFrame(document, frame, new Set([id])), { enterIds: [], updateIds: [], exitIds: [] })
      const collapsedButton = host.querySelector<SVGGElement>(`[data-sticky-collapse="${CSS.escape(id)}"]`)!
      expect(collapsedButton.getAttribute("aria-expanded")).toBe("false")
      expect(collapsedButton.textContent).toBe("+")
      collapsedButton.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
      resource.render(frame, { enterIds: [], updateIds: [], exitIds: [] })
      expect(host.querySelector(`[data-sticky-collapse="${CSS.escape(id)}"]`)!.getAttribute("aria-expanded")).toBe("true")
      expect({ focus, collapsed }).toEqual({ focus: [[actor.dataset.stickyId!], [], [id]], collapsed: [id, id] })
    } finally { subscriptions.forEach(subscription => subscription.unsubscribe()); resource.unsubscribe() }
  }
  host.remove()
})
