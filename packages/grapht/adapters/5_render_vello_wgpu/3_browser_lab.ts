// @ts-expect-error wasm-bindgen creates this module during the focused build.
import * as wasmModule from "./wasm/pkg/grapht_render_vello_wgpu.js"
import { loadCommonFixture } from "./0_fixture.ts"
import { BENCH_SCENARIO_CASES, createVelloScenarioHandlers, type VelloScenarioState } from "./2_scenarios.ts"
import { reduceBenchScenarioCases, type ScenarioRunReceipt, type ScenarioSample } from "../../src/11_scenarios.js"
import type { VelloWasmModule } from "./1_wasm.ts"
import "./4_style.css"

const { default: init, VelloBrowserRenderer } = wasmModule as unknown as VelloWasmModule
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

type VelloLabReceipt = {
  implementation: "vello-wasm-webgpu"
  status: "healthy" | "visual-invalid" | "renderer-error"
  fixture: string
  nodeCount: number
  edgeCount: number
  fixtureSource?: { url: string; bytes: number; sha256: string }
  wasm: { target: "wasm32-unknown-unknown"; batchedFixtureLoad: true; bridge: "wasm-bindgen" }
  webgpu?: { context: "webgpu"; surfaceFormat: string; presentedFrames: number }
  visualValidity?: { canvasWidth: number; canvasHeight: number; pixelProbeBytes: number; sceneUnits: number; drawnNodeCount: number; drawnEdgeCount: number; valid: boolean }
  scenarios: ScenarioRunReceipt<ScenarioSample>[]
  reason?: string
}

declare global {
  interface Window { graphtVelloLab?: { ready: Promise<VelloLabReceipt> } }
}

const canvas = document.querySelector<HTMLCanvasElement>("#graph")
const output = document.querySelector<HTMLOutputElement>("#receipt")
const nodeCount = Number(new URLSearchParams(location.search).get("nodes") ?? 1_000)
if (!canvas || !output) throw new Error("Vello browser lab mount missing")

const ready = (async (): Promise<VelloLabReceipt> => {
  try {
    await init()
    const loaded = await loadCommonFixture(nodeCount)
    canvas.width = 1024
    canvas.height = 768
    const renderer = await VelloBrowserRenderer.create(canvas, canvas.width, canvas.height)
    renderer.load_fixture_json(loaded.json)
    const sceneUnits = renderer.render_frame()
    await nextFrame()
    await nextFrame()
    const pixelProbeBytes = canvas.toDataURL("image/png").length
    const visualValidity = {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      pixelProbeBytes,
      sceneUnits,
      drawnNodeCount: renderer.node_count(),
      drawnEdgeCount: renderer.edge_count(),
      valid: pixelProbeBytes > 100 && sceneUnits > 0 && renderer.node_count() === loaded.fixture.nodeCount && renderer.edge_count() === loaded.fixture.edgeCount,
    }
    canvas.dataset.visualValid = String(visualValidity.valid)
    canvas.dataset.sceneCounters = JSON.stringify({ nodeCount: renderer.node_count(), edgeCount: renderer.edge_count(), sceneUnits })
    if (!visualValidity.valid) return { implementation: "vello-wasm-webgpu", status: "visual-invalid", fixture: loaded.fixture.id, nodeCount: loaded.fixture.nodeCount, edgeCount: loaded.fixture.edgeCount, fixtureSource: loaded.source, wasm: { target: "wasm32-unknown-unknown", batchedFixtureLoad: true, bridge: "wasm-bindgen" }, webgpu: { context: "webgpu", surfaceFormat: "rgba8unorm-or-bgra8unorm", presentedFrames: 1 }, visualValidity, scenarios: [] }
    if (new URLSearchParams(location.search).get("pause") === "1") await new Promise<void>(resolve => window.addEventListener("grapht-continue", () => resolve(), { once: true }))
    const state: VelloScenarioState = { renderer, fixture: loaded, canvas, disposed: false, lastSceneUnits: sceneUnits }
    const reduced = await reduceBenchScenarioCases(state, BENCH_SCENARIO_CASES, createVelloScenarioHandlers({ loadFixture: value => loadCommonFixture(fixtureSize(value)) }))
    return { implementation: "vello-wasm-webgpu", status: "healthy", fixture: loaded.fixture.id, nodeCount: loaded.fixture.nodeCount, edgeCount: loaded.fixture.edgeCount, fixtureSource: loaded.source, wasm: { target: "wasm32-unknown-unknown", batchedFixtureLoad: true, bridge: "wasm-bindgen" }, webgpu: { context: "webgpu", surfaceFormat: "rgba8unorm-or-bgra8unorm", presentedFrames: 1 }, visualValidity, scenarios: reduced.receipts }
  } catch (error) {
    return { implementation: "vello-wasm-webgpu", status: "renderer-error", fixture: `grid-${nodeCount}`, nodeCount, edgeCount: 0, wasm: { target: "wasm32-unknown-unknown", batchedFixtureLoad: true, bridge: "wasm-bindgen" }, scenarios: [], reason: error instanceof Error ? `${error.name}: ${error.message}` : String(error) }
  }
})()

function fixtureSize(value: string): number {
  const match = /(?:grid[-_])?(\d+(?:\.\d+)?)(k|m)?$/i.exec(value)
  if (!match) throw new Error(`unsupported fixture ${value}`)
  const multiplier = match[2]?.toLowerCase() === "m" ? 1_000_000 : match[2] ? 1_000 : 1
  return Math.round(Number(match[1]) * multiplier)
}

window.graphtVelloLab = { ready }
ready.then(value => { output.value = JSON.stringify(value, null, 2); output.textContent = output.value })
