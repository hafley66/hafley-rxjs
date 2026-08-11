import CanvasKitInit from "canvaskit-wasm"
import "./6_style.css"
import { Scene } from "./1_scene.js"
import { loadCommonFixture } from "./3_fixture.js"
import { fitCamera, pan, pickNearest, zoomAt } from "./2_hitTest.js"

const canvas = document.querySelector<HTMLCanvasElement>("#graph")!
const output = document.querySelector<HTMLOutputElement>("#receipt")!
const nodeCount = Number(new URLSearchParams(location.search).get("nodes") ?? 1_000)
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

try {
  const fixtureStarted = performance.now()
  const loaded = await loadCommonFixture(nodeCount)
  const geometry = loaded.geometry
  const fixtureMs = performance.now() - fixtureStarted
  const initStarted = performance.now()
  const ck = await CanvasKitInit({ locateFile: file => `/node_modules/canvaskit-wasm/bin/${file}` })
  const scene = new Scene(ck, canvas, geometry, { canvasId: "graph", nodeRadius: 2, selectionNodeRadius: 4 })
  scene.attach()
  const sceneConstructionMs = performance.now() - initStarted
  scene.setCamera(fitCamera(scene.geometry.positions, canvas.width, canvas.height))
  const firstRenderStarted = performance.now()
  scene.draw()
  await frame()
  const firstRenderMs = performance.now() - firstRenderStarted
  scene.setCamera(pan(scene.camera, 1, 1))
  scene.draw()
  await frame()
  const interactionSamples: number[] = []
  for (let index = 0; index < 5; index++) {
    const started = performance.now()
    scene.setCamera(pan(scene.camera, 2, 1))
    scene.setCamera(zoomAt(scene.camera, 1.01, 512, 384))
    const hit = pickNearest([512, 384], scene.camera, scene.geometry.positions, 12)
    scene.select(hit?.index ?? index % geometry.nodeCount)
    scene.draw()
    await frame()
    interactionSamples.push(performance.now() - started)
  }
  const sorted = [...interactionSamples].sort((a, b) => a - b)
  const memory = (performance as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (let index = 0; index < geometry.positions.length; index += 2) { minX = Math.min(minX, geometry.positions[index]); maxX = Math.max(maxX, geometry.positions[index]); minY = Math.min(minY, geometry.positions[index + 1]); maxY = Math.max(maxY, geometry.positions[index + 1]) }
  const visualValidity = { surfaceAttached: Boolean(scene.surface), sceneHasRendered: scene.hasRendered, drawnNodeCount: geometry.nodeCount, drawnEdgeCount: geometry.edgeCount, positionSpanX: maxX - minX, positionSpanY: maxY - minY, nodeRadiusWorld: 2, valid: Boolean(scene.surface) && scene.hasRendered && geometry.nodeCount > 0 && geometry.edgeCount > 0 && maxX > minX && maxY > minY }
  output.value = JSON.stringify({ implementation: "canvaskit", status: "healthy", setupValid: true, statusReason: "CanvasKit SW surface flushed and completed pan/zoom/select", actualRender: "MakeSWCanvasSurface + flush + RAF", warmupInteractionCount: 1, surfaceBackend: "MakeSWCanvasSurface", nodeCount: geometry.nodeCount, edgeCount: geometry.edgeCount, fixtureMs, sceneConstructionMs, firstRenderMs, interactionMedianMs: sorted[Math.floor(sorted.length / 2)], interactionP95Ms: sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)], jsHeapUsedBytes: memory?.usedJSHeapSize ?? null, jsHeapTotalBytes: memory?.totalJSHeapSize ?? null, wasmPages: scene.memoryPages(), fixtureSource: loaded.source, visualValidity }, null, 2)
  scene.dispose()
} catch (error) {
  output.value = JSON.stringify({ implementation: "canvaskit", status: "renderer-error", setupValid: false, statusReason: error instanceof Error ? `${error.name}: ${error.message}` : String(error), nodeCount, reason: error instanceof Error ? `${error.name}: ${error.message}` : String(error) }, null, 2)
}
