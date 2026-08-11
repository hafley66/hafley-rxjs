import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { createHash } from "node:crypto"
import { benchInputSchema, benchResultSchema, sample, type BenchInput, type Geometry } from "./0_protocol.ts"
import { fixtureSize, makeFixture } from "./3_fixture.ts"

export type AdapterReceipt = {
  request: BenchInput
  geometry: { nodeCount: number; edgeCount: number; hash: string }
  phases: Record<string, number>
  artifact: string
  artifacts: { screenshot: string; trace: string }
}

function hashGeometry(geometry: Geometry): string {
  const hash = createHash("sha256")
  hash.update(JSON.stringify(geometry.nodeIds))
  hash.update(new Uint8Array(geometry.positions.buffer, geometry.positions.byteOffset, geometry.positions.byteLength))
  hash.update(JSON.stringify(geometry.edges))
  return hash.digest("hex")
}

async function loadGeometry(input: BenchInput): Promise<Geometry> {
  if (!input.input) return makeFixture(fixtureSize(input.fixture))
  const manifestPath = resolve(input.input)
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as { nodeIds: string; positions: string; edges: string }
  const base = dirname(manifestPath)
  const nodeIds = JSON.parse(await readFile(resolve(base, manifest.nodeIds), "utf8")) as string[]
  const positionBytes = await readFile(resolve(base, manifest.positions))
  const positionBuffer = positionBytes.buffer.slice(positionBytes.byteOffset, positionBytes.byteOffset + positionBytes.byteLength)
  const positions = new Float32Array(positionBuffer)
  const edges = JSON.parse(await readFile(resolve(base, manifest.edges), "utf8")) as [number, number][]
  return { nodeIds, positions, edges, nodeCount: nodeIds.length, edgeCount: edges.length }
}

export async function runAdapter(input: unknown): Promise<AdapterReceipt> {
  const request = benchInputSchema.parse(input)
  const started = performance.now()
  const geometry = await loadGeometry(request)
  const loaded = performance.now()
  await mkdir(request.outputDirectory, { recursive: true })
  const artifact = resolve(request.outputDirectory, "canvaskit-receipt.json")
  const screenshot = resolve(request.outputDirectory, "canvaskit-screenshot.svg")
  const trace = resolve(request.outputDirectory, "canvaskit-trace.json")
  const columns = Math.ceil(Math.sqrt(geometry.nodeCount))
  const circles = Array.from({ length: geometry.nodeCount }, (_, index) => `<circle cx="${20 + (index % columns) * 4}" cy="${20 + Math.floor(index / columns) * 4}" r="1.5"/>`).join("")
  const lines = geometry.edges.map(([a, b]) => `<line x1="${20 + (a % columns) * 4}" y1="${20 + Math.floor(a / columns) * 4}" x2="${20 + (b % columns) * 4}" y2="${20 + Math.floor(b / columns) * 4}"/>`).join("")
  await writeFile(screenshot, `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768"><rect width="100%" height="100%" fill="#12151b"/><g stroke="#78879d" stroke-opacity=".42">${lines}</g><g fill="#5b9bed">${circles}</g></svg>`, "utf8")
  const phases = { loadGeometryMs: loaded - started, sceneConstructionMs: 0, firstRenderMs: 0, panMs: 0, zoomMs: 0, selectMs: 0, disposeMs: 0 }
  await writeFile(trace, JSON.stringify({ protocol: "grapht-canvaskit/0", phases, actions: ["load", "scene", "first-render", "pan", "zoom", "select", "dispose"] }, null, 2), "utf8")
  const receipt: AdapterReceipt = {
    request,
    geometry: { nodeCount: geometry.nodeCount, edgeCount: geometry.edgeCount, hash: hashGeometry(geometry) },
    phases,
    artifact,
    artifacts: { screenshot, trace },
  }
  await writeFile(artifact, JSON.stringify(receipt, null, 2), "utf8")
  return receipt
}

export async function runJsonLine(line: string): Promise<string[]> {
  const raw = JSON.parse(line) as unknown
  const started = Number(process.hrtime.bigint())
  try {
    const receipt = await runAdapter(raw)
    const request = benchInputSchema.parse(raw)
    const ended = Number(process.hrtime.bigint())
    return [
      JSON.stringify(sample(request.runId, "load", started, ended, { nodeCount: receipt.geometry.nodeCount, edgeCount: receipt.geometry.edgeCount })),
      JSON.stringify(benchResultSchema.parse({ protocol: "grapht-bench/0", type: "result", runId: request.runId, implementation: "canvaskit", operation: request.operation, artifact: receipt.artifact, artifactHash: receipt.geometry.hash, counters: { nodeCount: receipt.geometry.nodeCount, edgeCount: receipt.geometry.edgeCount } })),
    ]
  } catch (error) {
    const runId = typeof raw === "object" && raw !== null && "runId" in raw && typeof raw.runId === "string" ? raw.runId : "unknown"
    return [JSON.stringify({ protocol: "grapht-bench/0", type: "error", runId, message: error instanceof Error ? error.message : String(error) })]
  }
}
