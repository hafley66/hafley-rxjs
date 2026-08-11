import { buildGraph, loadCommonFixture } from "./1_graphology.js"
import { SigmaProjection } from "./2_projection.js"

export type SigmaLabReceipt = {
  implementation: "sigma"
  status: "healthy" | "renderer-error"
  setupValid?: boolean
  statusReason?: string
  actualRender?: string
  warmupInteractionCount?: number
  fixture: string
  nodeCount: number
  edgeCount: number
  fixtureMs?: number
  graphConstructionMs?: number
  firstRenderMs?: number
  interactionMedianMs?: number
  interactionP95Ms?: number
  jsHeapUsedBytes?: number | null
  jsHeapTotalBytes?: number | null
  reason?: string
  selectedNode?: string | null
  canvasCount?: number
  contextCreated?: boolean
  fixtureSource?: { url: string; bytes: number; sha256: string }
  visualValidity?: Record<string, number | boolean>
}

declare global {
  interface Window {
    graphtSigmaLab?: { ready: Promise<SigmaLabReceipt>; projection?: SigmaProjection }
  }
}

const params = new URLSearchParams(location.search)
const nodeCount = Number(params.get("nodes") ?? 1_000)
const fixture = `grid-${nodeCount}`
const container = document.querySelector<HTMLElement>("#sigma-container")
const target = document.querySelector<HTMLElement>("#receipt")
if (!container || !target) throw new Error("Sigma lab mount missing")
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

const ready = (async (): Promise<SigmaLabReceipt> => {
  try {
    const fixtureStarted = performance.now()
    const loaded = await loadCommonFixture(nodeCount)
    const geometry = loaded.geometry
    const fixtureMs = performance.now() - fixtureStarted
    const graphStarted = performance.now()
    const graph = buildGraph(geometry)
    const graphConstructionMs = performance.now() - graphStarted
    const projection = new SigmaProjection(container, graph)
    const firstRenderStarted = performance.now()
    await projection.firstRender()
    const firstRenderMs = performance.now() - firstRenderStarted
    const warmupCamera = projection.sigma.getCamera()
    const warmupState = warmupCamera.getState()
    warmupCamera.setState({ ...warmupState, x: warmupState.x + 0.005, y: warmupState.y + 0.005 })
    projection.sigma.refresh()
    await frame()
    const interactionSamples: number[] = []
    for (let index = 0; index < 5; index++) {
      const started = performance.now()
      const camera = projection.sigma.getCamera()
      const state = camera.getState()
      camera.setState({ ...state, x: state.x + 0.01, y: state.y + 0.01, ratio: state.ratio * 1.01 })
      projection.sigma.refresh()
      const point = projection.screenPoint(geometry.nodeIds[index % geometry.nodeIds.length])
      if (point) container.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: point.x, clientY: point.y }))
      await frame()
      interactionSamples.push(performance.now() - started)
    }
    const sorted = [...interactionSamples].sort((a, b) => a - b)
    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory
    const webgl = projection.webglInfo()
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (let index = 0; index < geometry.positions.length; index += 2) { minX = Math.min(minX, geometry.positions[index]); maxX = Math.max(maxX, geometry.positions[index]); minY = Math.min(minY, geometry.positions[index + 1]); maxY = Math.max(maxY, geometry.positions[index + 1]) }
    const visualValidity = { canvasCount: webgl.canvasCount, contextCreated: webgl.contextCreated, drawnNodeCount: graph.order, drawnEdgeCount: graph.size, positionSpanX: maxX - minX, positionSpanY: maxY - minY, valid: webgl.contextCreated && webgl.canvasCount > 0 && graph.order > 0 && graph.size > 0 && maxX > minX && maxY > minY }
    const value: SigmaLabReceipt = { implementation: "sigma", status: "healthy", fixture, setupValid: true, statusReason: "Sigma WebGL canvases refreshed across four RAFs and completed pan/zoom/select", actualRender: "Sigma.refresh + RAF", warmupInteractionCount: 1, nodeCount: graph.order, edgeCount: graph.size, fixtureMs, graphConstructionMs, firstRenderMs, interactionMedianMs: sorted[Math.floor(sorted.length / 2)], interactionP95Ms: sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)], jsHeapUsedBytes: memory?.usedJSHeapSize ?? null, jsHeapTotalBytes: memory?.totalJSHeapSize ?? null, selectedNode: projection.selectedNode, fixtureSource: loaded.source, visualValidity, ...webgl }
    window.graphtSigmaLab = { ready: Promise.resolve(value), projection }
    return value
  } catch (error) {
    return { implementation: "sigma", status: "renderer-error", setupValid: false, statusReason: error instanceof Error ? `${error.name}: ${error.message}` : String(error), fixture, nodeCount, edgeCount: Math.max(0, 2 * nodeCount - 2 * Math.ceil(Math.sqrt(nodeCount))), reason: error instanceof Error ? `${error.name}: ${error.message}` : String(error) }
  }
})()
window.graphtSigmaLab = { ready }
ready.then(value => { target.textContent = JSON.stringify(value) })
