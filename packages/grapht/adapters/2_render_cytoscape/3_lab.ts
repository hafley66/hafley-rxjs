import cytoscape from "cytoscape"
import { loadCommonFixture } from "./3_fixture.ts"
import { createProjection } from "./1_projection.ts"
import "./3_style.css"

const mount = document.querySelector<HTMLDivElement>("#graph")!
const output = document.querySelector<HTMLOutputElement>("#receipt")!
const nodeCount = Number(new URLSearchParams(location.search).get("nodes") ?? 1_000)
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
function positionSpans(positions: Float32Array): [number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (let index = 0; index < positions.length; index += 2) {
    minX = Math.min(minX, positions[index]); maxX = Math.max(maxX, positions[index])
    minY = Math.min(minY, positions[index + 1]); maxY = Math.max(maxY, positions[index + 1])
  }
  return [maxX - minX, maxY - minY]
}

try {
  const fixtureStarted = performance.now()
  const loaded = await loadCommonFixture(nodeCount)
  const geometry = loaded.geometry
  const fixtureMs = performance.now() - fixtureStarted
  const constructionStarted = performance.now()
  const projection = createProjection(geometry, mount)
  const constructionMs = performance.now() - constructionStarted
  projection.cy.fit(undefined, 20)
  const firstRenderStarted = performance.now()
  await frame()
  await frame()
  const firstRenderMs = performance.now() - firstRenderStarted
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
  const warmupCamera = projection.camera()
  projection.cy.pan({ x: warmupCamera.pan.x + 1, y: warmupCamera.pan.y + 1 })
  projection.cy.zoom({ level: warmupCamera.zoom * 1.01, renderedPosition: { x: 256, y: 192 } })
  projection.cy.getElementById(geometry.nodeIds[0]).select()
  await frame()
  const interactionSamples: number[] = []
  for (let i = 0; i < 5; i++) {
    const started = performance.now()
    const camera = projection.camera()
    projection.cy.pan({ x: camera.pan.x + 2, y: camera.pan.y + 1 })
    projection.cy.zoom({ level: camera.zoom * 1.01, renderedPosition: { x: 256, y: 192 } })
    projection.cy.nodes().unselect()
    projection.cy.getElementById(geometry.nodeIds[i % geometry.nodeCount]).select()
    await frame()
    interactionSamples.push(performance.now() - started)
  }
  const sorted = [...interactionSamples].sort((a, b) => a - b)
  const memory = (performance as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory
  const [positionSpanX, positionSpanY] = positionSpans(geometry.positions)
  const visualValidity = { canvasCount: canvases.length, nonBackgroundPixelCount, drawnNodeCount: projection.cy.nodes().length, drawnEdgeCount: projection.cy.edges().length, positionSpanX, positionSpanY, valid: canvases.length > 0 && nonBackgroundPixelCount > 0 }
  output.value = JSON.stringify({ implementation: String((cytoscape as unknown as { version?: string }).version ?? "cytoscape"), status: "healthy", setupValid: true, statusReason: "Cytoscape mounted, rendered across two RAFs, and completed pan/zoom/select", actualRender: "mounted Cytoscape canvas", warmupInteractionCount: 1, nodeCount: geometry.nodeCount, edgeCount: geometry.edgeCount, fixtureMs, constructionMs, firstRenderMs, interactionMedianMs: sorted[Math.floor(sorted.length / 2)], interactionP95Ms: sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)], jsHeapUsedBytes: memory?.usedJSHeapSize ?? null, jsHeapTotalBytes: memory?.totalJSHeapSize ?? null, fixtureSource: loaded.source, visualValidity }, null, 2)
  projection.dispose()
} catch (error) {
  output.value = JSON.stringify({ implementation: "cytoscape", status: "renderer-error", setupValid: false, statusReason: error instanceof Error ? `${error.name}: ${error.message}` : String(error), nodeCount, reason: error instanceof Error ? `${error.name}: ${error.message}` : String(error) }, null, 2)
}
