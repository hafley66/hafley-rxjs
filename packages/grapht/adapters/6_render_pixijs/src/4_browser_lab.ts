import type { Geometry } from "../../../src/1_geometryProtocol.js"
import { BENCH_SCENARIO_CASES, reduceBenchScenarioCases, type ScenarioRunReceipt, type ScenarioSample } from "../../../src/11_scenarios.js"
import type { ShakeCameraState } from "../../../src/12_shake.js"
import { evaluateVisualValidity, type VisualValidity } from "../../../src/13_visualValidity.js"
import { loadCommonFixture, fixtureSize } from "./1_fixture.js"
import { PixiProjection, type ActualBackend, type RendererMode, type Representation } from "./2_projection.js"
import { createPixiScenarioHandlers, initialPixiScenarioState, type PixiScenarioState } from "./6_scenarios.js"

export type WebGpuProbe = {
  available: boolean
  reason?: string
  adapter?: { vendor: string; architecture: string; device: string; description?: string }
  deviceRequested: boolean
}

type PixiLabReceipt = {
  implementation: "pixijs"
  protocol: "grapht-pixijs-receipt/0"
  status: "healthy" | "visual-invalid" | "renderer-error" | "webgpu-unavailable"
  renderer: RendererMode
  representation: Representation
  fixture: string
  nodeCount: number
  edgeCount: number
  fixtureSource?: { url: string; bytes: number; sha256: string }
  visualValidity?: VisualValidity
  cameraState?: ShakeCameraState
  webgpuProbe?: WebGpuProbe
  scenarios: ScenarioRunReceipt<ScenarioSample>[]
  reason?: string
}

declare global {
  interface Window {
    graphtPixiLab?: { ready: Promise<PixiLabReceipt> }
  }
}

export function probeWebGpu(): Promise<WebGpuProbe> {
  const gpu = (navigator as { gpu?: { requestAdapter?: () => Promise<unknown> } }).gpu
  if (!gpu?.requestAdapter) {
    return Promise.resolve({ available: false, reason: "navigator.gpu is unavailable", deviceRequested: false })
  }
  return (async () => {
    type RawAdapter = {
      info?: { vendor: string; architecture: string; device: string; description?: string }
      requestDevice?: () => Promise<unknown>
    }
    let adapter: RawAdapter | null = null
    try {
      adapter = (await gpu.requestAdapter!()) as RawAdapter | null
    } catch (error) {
      return { available: false, reason: `requestAdapter threw: ${String(error)}`, deviceRequested: false }
    }
    if (!adapter) return { available: false, reason: "requestAdapter returned null", deviceRequested: false }
    const info = adapter.info ?? { vendor: "unknown", architecture: "unknown", device: "unknown" }
    try {
      await adapter.requestDevice?.()
      return { available: true, adapter: info, deviceRequested: true }
    } catch (error) {
      return {
        available: false,
        reason: `requestDevice failed: ${error instanceof Error ? error.message : String(error)}`,
        adapter: info,
        deviceRequested: false,
      }
    }
  })()
}

function visualValidity(projection: PixiProjection, requested: RendererMode): VisualValidity {
  return evaluateVisualValidity({
    readback: projection.readViewportPixels(),
    drawnNodeCount: projection.currentNodeCount(),
    drawnEdgeCount: projection.currentEdgeCount(),
    actualBackend: projection.actualBackend,
    requestedRenderer: requested,
  })
}

function container(): HTMLElement {
  const el = document.querySelector<HTMLElement>("#pixi-container")
  if (!el) throw new Error("PixiJS lab mount missing")
  return el
}

function readParam(name: string, fallback: string): string {
  return new URLSearchParams(location.search).get(name) ?? fallback
}

function rendererOf(value: string): RendererMode {
  return value === "webgpu" ? "webgpu" : "webgl"
}

function representationOf(value: string): Representation {
  return value === "particles" ? "particles" : "retained"
}

async function renderWebGlEvidence(geometry: Geometry, representation: Representation): Promise<{ valid: boolean }> {
  let evidenceHost = document.querySelector<HTMLElement>("#webgl-evidence")
  if (!evidenceHost) {
    evidenceHost = document.createElement("div")
    evidenceHost.id = "webgl-evidence"
    container().parentElement?.appendChild(evidenceHost)
  }
  evidenceHost.textContent = ""
  const projection = new PixiProjection(evidenceHost, geometry, { renderer: "webgl", representation })
  await projection.init()
  await projection.firstRender()
  const validity = visualValidity(projection, "webgl")
  evidenceHost.dataset.visualValid = String(validity.valid)
  return { valid: validity.valid }
}

function mark(host: HTMLElement, key: string, value: string): void {
  host.dataset[key] = value
}

async function buildLab(): Promise<PixiLabReceipt> {
  const host = container()
  const target = document.querySelector<HTMLElement>("#receipt")
  const nodeCount = Number(readParam("nodes", "1000"))
  const renderer = rendererOf(readParam("renderer", "webgl"))
  const representation = representationOf(readParam("representation", "retained"))
  const fixture = `grid-${nodeCount}`
  const pause = readParam("pause", "0") === "1"
  try {
    const loaded = await loadCommonFixture(fixtureSize(fixture))
    const webgpuProbe = renderer === "webgpu" ? await probeWebGpu() : undefined

    if (renderer === "webgpu" && webgpuProbe && !webgpuProbe.available) {
      mark(host, "receiptStatus", "webgpu-unavailable")
      mark(host, "webgpuReason", webgpuProbe.reason ?? "unknown")
      mark(host, "webgpuAdapter", webgpuProbe.adapter ? JSON.stringify(webgpuProbe.adapter) : "none")
      const evidence = await renderWebGlEvidence(loaded.geometry, representation)
      mark(host, "evidenceVisualValid", String(evidence.valid))
      mark(host, "visualValid", String(evidence.valid))
      return {
        implementation: "pixijs",
        protocol: "grapht-pixijs-receipt/0",
        status: "webgpu-unavailable",
        renderer,
        representation,
        fixture,
        nodeCount: loaded.geometry.nodeIds.length,
        edgeCount: loaded.geometry.edges.length,
        fixtureSource: loaded.source,
        webgpuProbe,
        scenarios: [],
        reason: `WebGPU not available in this browser: ${webgpuProbe.reason}`,
      }
    }

    const projection = new PixiProjection(host, loaded.geometry, { renderer, representation })
    await projection.init()

    if (renderer === "webgpu" && projection.actualBackend !== "webgpu") {
      mark(host, "receiptStatus", "webgpu-unavailable")
      mark(host, "webgpuReason", `PixiJS produced ${projection.actualBackend} despite requested webgpu`)
      mark(host, "webgpuAdapter", "unknown-adapter")
      const evidence = await renderWebGlEvidence(loaded.geometry, representation)
      mark(host, "evidenceVisualValid", String(evidence.valid))
      mark(host, "visualValid", String(evidence.valid))
      return {
        implementation: "pixijs",
        protocol: "grapht-pixijs-receipt/0",
        status: "webgpu-unavailable",
        renderer,
        representation,
        fixture,
        nodeCount: loaded.geometry.nodeIds.length,
        edgeCount: loaded.geometry.edges.length,
        fixtureSource: loaded.source,
        webgpuProbe,
        scenarios: [],
        reason: `PixiJS produced ${projection.actualBackend}, not webgpu`,
      }
    }

    await projection.firstRender()
    const validity = visualValidity(projection, renderer)
    mark(host, "visualValid", String(validity.valid))
    mark(host, "actualBackend", validity.actualBackend)
    mark(host, "nonBackgroundPixels", String(validity.nonBackgroundPixels))
    mark(host, "receiptStatus", "ready")

    if (pause) await new Promise<void>(resolve => window.addEventListener("grapht-continue", () => resolve(), { once: true }))

    if (!validity.valid) {
      return {
        implementation: "pixijs",
        protocol: "grapht-pixijs-receipt/0",
        status: "visual-invalid",
        renderer,
        representation,
        fixture,
        nodeCount: validity.drawnNodeCount,
        edgeCount: validity.drawnEdgeCount,
        fixtureSource: loaded.source,
        visualValidity: validity,
        scenarios: [],
        reason: "no non-background pixels detected after first render",
      }
    }

    const state: PixiScenarioState = initialPixiScenarioState(loaded.geometry, host, loaded.source.bytes, projection)
    const reduced = await reduceBenchScenarioCases(state, BENCH_SCENARIO_CASES, createPixiScenarioHandlers({
      loadFixture: async value => {
        const next = await loadCommonFixture(fixtureSize(value))
        return { geometry: next.geometry, bytes: next.source.bytes }
      },
    }))
    return {
      implementation: "pixijs",
      protocol: "grapht-pixijs-receipt/0",
      status: "healthy",
      renderer,
      representation,
      fixture,
      nodeCount: validity.drawnNodeCount,
      edgeCount: validity.drawnEdgeCount,
      fixtureSource: loaded.source,
      visualValidity: validity,
      cameraState: reduced.state.cameraState ?? undefined,
      scenarios: reduced.receipts,
    }
  } catch (error) {
    mark(host, "receiptStatus", "renderer-error")
    return {
      implementation: "pixijs",
      protocol: "grapht-pixijs-receipt/0",
      status: "renderer-error",
      renderer,
      representation,
      fixture,
      nodeCount,
      edgeCount: 0,
      scenarios: [],
      reason: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    }
  }
}

const ready = buildLab()
window.graphtPixiLab = { ready }
ready.then(value => {
  const target = document.querySelector<HTMLElement>("#receipt")
  if (target) target.textContent = JSON.stringify(value)
})
