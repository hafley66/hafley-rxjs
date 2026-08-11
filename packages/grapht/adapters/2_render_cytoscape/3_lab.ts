import cytoscape from "cytoscape"
import { BENCH_SCENARIO_CASES, reduceBenchScenarioCases, type ScenarioRunReceipt, type ScenarioSample } from "../../src/11_scenarios.js"
import { createCytoscapeScenarioHandlers, initialCytoscapeScenarioState } from "./5_scenarios.js"
import { fixtureSize, loadCommonFixture } from "./3_fixture.js"
import "./3_style.css"

type CytoscapeLabReceipt = {
  implementation: "cytoscape"
  status: "healthy" | "visual-invalid" | "renderer-error"
  fixture: string
  nodeCount: number
  edgeCount: number
  fixtureSource?: { url: string; bytes: number; sha256: string }
  visualValidity?: { canvasCount: number; nonBackgroundPixelCount: number; drawnNodeCount: number; drawnEdgeCount: number; valid: boolean }
  scenarios: ScenarioRunReceipt<ScenarioSample>[]
  reason?: string
}

declare global {
  interface Window { graphtCytoscapeLab?: { ready: Promise<CytoscapeLabReceipt> } }
}

const mount = document.querySelector<HTMLDivElement>("#graph")
const output = document.querySelector<HTMLOutputElement>("#receipt")
const nodeCount = Number(new URLSearchParams(location.search).get("nodes") ?? 1_000)
const fixture = `grid-${nodeCount}`
if (!mount || !output) throw new Error("Cytoscape lab mount missing")

const ready = (async (): Promise<CytoscapeLabReceipt> => {
  try {
    const loaded = await loadCommonFixture(fixtureSize(fixture))
    const state = initialCytoscapeScenarioState(loaded.geometry, mount, loaded.source.bytes)
    const projection = state.projection
    if (!projection) throw new Error("Cytoscape projection was not created")
    projection.cy.fit(undefined, 20)
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    const canvases = Array.from(mount.querySelectorAll("canvas"))
    const nonBackgroundPixelCount = canvases.reduce((total, current) => {
      const context = current.getContext("2d")
      if (!context || current.width === 0 || current.height === 0) return total
      const pixels = context.getImageData(0, 0, current.width, current.height).data
      let count = 0
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index + 3] > 0 && (pixels[index] !== 18 || pixels[index + 1] !== 21 || pixels[index + 2] !== 27)) count++
      }
      return total + count
    }, 0)
    const visualValidity = { canvasCount: canvases.length, nonBackgroundPixelCount, drawnNodeCount: loaded.geometry.nodeCount, drawnEdgeCount: loaded.geometry.edgeCount, valid: canvases.length > 0 && nonBackgroundPixelCount > 0 }
    mount.dataset.visualValid = String(visualValidity.valid)
    if (new URLSearchParams(location.search).get("pause") === "1") await new Promise<void>(resolve => window.addEventListener("grapht-continue", () => resolve(), { once: true }))
    if (!visualValidity.valid) return { implementation: "cytoscape", status: "visual-invalid", fixture, nodeCount: loaded.geometry.nodeCount, edgeCount: loaded.geometry.edgeCount, fixtureSource: loaded.source, visualValidity, scenarios: [] }
    const reduced = await reduceBenchScenarioCases(state, BENCH_SCENARIO_CASES, createCytoscapeScenarioHandlers({ loadFixture: async value => { const next = await loadCommonFixture(fixtureSize(value)); return { geometry: next.geometry, bytes: next.source.bytes } } }))
    return { implementation: "cytoscape", status: "healthy", fixture, nodeCount: loaded.geometry.nodeCount, edgeCount: loaded.geometry.edgeCount, fixtureSource: loaded.source, visualValidity, scenarios: reduced.receipts }
  } catch (error) {
    return { implementation: "cytoscape", status: "renderer-error", fixture, nodeCount, edgeCount: 0, scenarios: [], reason: error instanceof Error ? `${error.name}: ${error.message}` : String(error) }
  }
})()

window.graphtCytoscapeLab = { ready }
ready.then(value => { const text = JSON.stringify(value); output.value = text; output.textContent = text })
