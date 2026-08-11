import { BENCH_SCENARIO_CASES, reduceBenchScenarioCases, type ScenarioRunReceipt, type ScenarioSample } from "../../../src/11_scenarios.js"
import { fixtureSize, loadCommonFixture } from "./1_graphology.js"
import { createSigmaScenarioHandlers, initialSigmaScenarioState } from "./6_scenarios.js"

type SigmaLabReceipt = {
  implementation: "sigma"
  status: "healthy" | "visual-invalid" | "renderer-error"
  fixture: string
  nodeCount: number
  edgeCount: number
  fixtureSource?: { url: string; bytes: number; sha256: string }
  visualValidity?: { canvasCount: number; contextCreated: boolean; drawnNodeCount: number; drawnEdgeCount: number; positionSpanX: number; positionSpanY: number; valid: boolean }
  scenarios: ScenarioRunReceipt<ScenarioSample>[]
  reason?: string
}

declare global {
  interface Window { graphtSigmaLab?: { ready: Promise<SigmaLabReceipt> } }
}

const container = document.querySelector<HTMLElement>("#sigma-container")
const target = document.querySelector<HTMLElement>("#receipt")
const nodeCount = Number(new URLSearchParams(location.search).get("nodes") ?? 1_000)
const fixture = `grid-${nodeCount}`
if (!container || !target) throw new Error("Sigma lab mount missing")

const ready = (async (): Promise<SigmaLabReceipt> => {
  try {
    const loaded = await loadCommonFixture(fixtureSize(fixture))
    const state = initialSigmaScenarioState(loaded.geometry, container, loaded.source.bytes)
    const projection = state.projection
    if (!projection) throw new Error("Sigma projection was not created")
    await projection.firstRender()
    const webgl = projection.webglInfo()
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (let index = 0; index < loaded.geometry.positions.length; index += 2) { minX = Math.min(minX, loaded.geometry.positions[index]); maxX = Math.max(maxX, loaded.geometry.positions[index]); minY = Math.min(minY, loaded.geometry.positions[index + 1]); maxY = Math.max(maxY, loaded.geometry.positions[index + 1]) }
    const drawnNodeCount = projection.currentNodeCount()
    const drawnEdgeCount = projection.currentEdgeCount()
    const visualValidity = { canvasCount: webgl.canvasCount, contextCreated: webgl.contextCreated, drawnNodeCount, drawnEdgeCount, positionSpanX: maxX - minX, positionSpanY: maxY - minY, valid: webgl.contextCreated && webgl.canvasCount > 0 && maxX > minX && maxY > minY }
    container.dataset.visualValid = String(visualValidity.valid)
    if (new URLSearchParams(location.search).get("pause") === "1") await new Promise<void>(resolve => window.addEventListener("grapht-continue", () => resolve(), { once: true }))
    if (!visualValidity.valid) return { implementation: "sigma", status: "visual-invalid", fixture, nodeCount: drawnNodeCount, edgeCount: drawnEdgeCount, fixtureSource: loaded.source, visualValidity, scenarios: [] }
    const reduced = await reduceBenchScenarioCases(state, BENCH_SCENARIO_CASES, createSigmaScenarioHandlers({ loadFixture: async value => { const next = await loadCommonFixture(fixtureSize(value)); return { geometry: next.geometry, bytes: next.source.bytes } } }))
    return { implementation: "sigma", status: "healthy", fixture, nodeCount: drawnNodeCount, edgeCount: drawnEdgeCount, fixtureSource: loaded.source, visualValidity, scenarios: reduced.receipts }
  } catch (error) {
    return { implementation: "sigma", status: "renderer-error", fixture, nodeCount, edgeCount: 0, scenarios: [], reason: error instanceof Error ? `${error.name}: ${error.message}` : String(error) }
  }
})()

window.graphtSigmaLab = { ready }
ready.then(value => { target.textContent = JSON.stringify(value) })
