import CanvasKitInit from "canvaskit-wasm"
import "./6_style.css"
import { Scene } from "./1_scene.js"
import { loadCommonFixture } from "./3_fixture.js"
import { fitCamera } from "./2_hitTest.js"
import { initialState, reduce } from "./9_scenario.js"
import type { CanvasKitScenarioState } from "./9_scenario.js"
import { BENCH_SCENARIOS } from "./9_scenarioKeys.js"
const canvas = document.querySelector<HTMLCanvasElement>("#graph")!
const output = document.querySelector<HTMLOutputElement>("#receipt")!
const nodeCount = Number(new URLSearchParams(location.search).get("nodes") ?? 1_000)

try {
  const fixtureStarted = performance.now()
  const loaded = await loadCommonFixture(nodeCount)
  const fixtureMs = performance.now() - fixtureStarted

  const initStarted = performance.now()
  const ck = await CanvasKitInit({ locateFile: file => `/node_modules/canvaskit-wasm/bin/${file}` })
  const scene = new Scene(ck, canvas, loaded.geometry, { canvasId: "graph", nodeRadius: 2, selectionNodeRadius: 4 })
  scene.attach()
  scene.setCamera(fitCamera(scene.geometry.positions, canvas.width, canvas.height))

  let state: CanvasKitScenarioState = initialState({
    geometry: loaded.geometry,
    renderer: scene,
    viewport: { width: canvas.width, height: canvas.height },
  })

  const scenarioSequence: { scenario: string; args: Record<string, unknown> }[] = [
    { scenario: "camera-pan", args: { dx: 12, dy: -8, frames: 4 } },
    { scenario: "camera-wheel-zoom", args: { deltaY: -100, anchorX: 512, anchorY: 384, frames: 4 } },
    { scenario: "style-update", args: { nodeCount, color: 0x22ff88 } },
    { scenario: "position-update", args: { nodeCount: 250, dx: 4, dy: 2 } },
    { scenario: "viewport-resize", args: { width: 1280, height: 720 } },
    { scenario: "group-collapse", args: { groupIds: [0] } },
    { scenario: "group-expand", args: { groupIds: [0] } },
    { scenario: "layout-apply", args: { positionCount: 500 } },
    { scenario: "position-animation", args: { nodeCount: 500, frames: 24, durationMs: 400 } },
    { scenario: "graph-replace", args: { fixture: `grid-${nodeCount}` } },
    { scenario: "graph-dispose", args: {} },
  ]

  const samples: Record<string, unknown>[] = []
  for (const { scenario, args } of scenarioSequence) {
    const { state: next, sample } = reduce(state, { scenario, args } as never)
    state = next
    samples.push(sample)
    if (state.renderer) {
      state.renderer.setCamera(fitCamera(state.positions, canvas.width, canvas.height))
      state.renderer.draw()
    }
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (let index = 0; index < loaded.geometry.positions.length; index += 2) {
    minX = Math.min(minX, loaded.geometry.positions[index]); maxX = Math.max(maxX, loaded.geometry.positions[index])
    minY = Math.min(minY, loaded.geometry.positions[index + 1]); maxY = Math.max(maxY, loaded.geometry.positions[index + 1])
  }
  const supported = Object.keys(samples).filter(index => samples[Number(index)]?.supported)
  const unsupported = BENCH_SCENARIOS.filter(scenario => !scenarioSequence.some(s => s.scenario === scenario))
  const visualValidity = {
    surfaceAttached: Boolean(scene.surface),
    sceneHasRendered: scene.hasRendered,
    drawnNodeCount: nodeCount,
    drawnEdgeCount: loaded.geometry.edgeCount,
    positionSpanX: maxX - minX,
    positionSpanY: maxY - minY,
    valid: Boolean(scene.surface) && scene.hasRendered && nodeCount > 0 && loaded.geometry.edgeCount > 0 && maxX > minX && maxY > minY,
  }
  output.value = JSON.stringify({
    implementation: "canvaskit",
    renderer: "scenario",
    status: "healthy",
    setupValid: true,
    fixtureMs,
    nodeCount,
    edgeCount: loaded.geometry.edgeCount,
    scenarioCount: samples.length,
    supportedCount: supported.length,
    unsupportedCount: unsupported.length,
    supportedScenarios: scenarioSequence.map(s => s.scenario),
    unsupportedScenarios: unsupported,
    lastSample: samples[samples.length - 1],
    visualValidity,
  }, null, 2)
} catch (error) {
  output.value = JSON.stringify({ implementation: "canvaskit", renderer: "scenario", status: "renderer-error", setupValid: false, statusReason: error instanceof Error ? `${error.name}: ${error.message}` : String(error) }, null, 2)
}
