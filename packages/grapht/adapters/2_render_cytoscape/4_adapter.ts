import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { benchInputSchema, sample, type BenchInput, type Geometry, type GeometryManifest } from "./0_protocol.ts"
import { fixtureSize, makeFixture } from "./3_fixture.ts"
import { createProjection, exerciseInteraction } from "./1_projection.ts"

export type ProjectionReceipt = {
  implementation: "cytoscape"; request: BenchInput; geometry: { nodeCount: number; edgeCount: number; hash: string }
  phases: Record<string, number>; selectedId?: string; camera: { pan: { x: number; y: number }; zoom: number }
  artifacts: { screenshot: string; trace: string; receipt: string }
}

function geometryHash(geometry: Geometry): string {
  const hash = createHash("sha256")
  hash.update(JSON.stringify(geometry.nodeIds))
  hash.update(new Uint8Array(geometry.positions.buffer, geometry.positions.byteOffset, geometry.positions.byteLength))
  hash.update(JSON.stringify(geometry.edges))
  return hash.digest("hex")
}

async function loadGeometry(input: BenchInput): Promise<Geometry> {
  if (!input.input) return makeFixture(fixtureSize(input.fixture))
  const manifestPath = resolve(input.input)
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as GeometryManifest
  const base = dirname(manifestPath)
  const nodeIds = JSON.parse(await readFile(resolve(base, manifest.nodeIds), "utf8")) as string[]
  const positionBytes = await readFile(resolve(base, manifest.positions))
  const positions = new Float32Array(positionBytes.buffer.slice(positionBytes.byteOffset, positionBytes.byteOffset + positionBytes.byteLength))
  const edges = JSON.parse(await readFile(resolve(base, manifest.edges), "utf8")) as [number, number][]
  return { nodeIds, positions, edges, nodeCount: nodeIds.length, edgeCount: edges.length }
}

function writeSvg(path: string, geometry: Geometry): string {
  const width = 1024, height = 768, scale = Math.min((width - 40) / Math.max(1, Math.sqrt(geometry.nodeCount)), (height - 40) / Math.max(1, Math.sqrt(geometry.nodeCount)))
  const nodes = geometry.positions.length / 2
  const edges = geometry.edges.map(([a, b]) => `<line x1="${20 + geometry.positions[a * 2] * scale}" y1="${20 + geometry.positions[a * 2 + 1] * scale}" x2="${20 + geometry.positions[b * 2] * scale}" y2="${20 + geometry.positions[b * 2 + 1] * scale}"/>`).join("")
  const circles = Array.from({ length: nodes }, (_, index) => `<circle cx="${20 + geometry.positions[index * 2] * scale}" cy="${20 + geometry.positions[index * 2 + 1] * scale}" r="3"/>`).join("")
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#12151b"/><g stroke="#78879d" stroke-opacity=".42">${edges}</g><g fill="#5b9bed">${circles}</g></svg>`
  return writeFile(path, svg, "utf8").then(() => path) as unknown as string
}

export async function runAdapter(raw: unknown): Promise<ProjectionReceipt> {
  const request = benchInputSchema.parse(raw)
  await mkdir(request.outputDirectory, { recursive: true })
  const phases: Record<string, number> = {}
  const started = performance.now(); const geometry = await loadGeometry(request); phases.loadGeometryMs = performance.now() - started
  const construction = performance.now(); const projection = createProjection(geometry); phases.projectionMs = performance.now() - construction
  const interaction = performance.now(); const result = exerciseInteraction(projection, geometry.nodeIds[Math.min(geometry.nodeCount - 1, 0)]); phases.interactionMs = performance.now() - interaction
  const screenshot = resolve(request.outputDirectory, "cytoscape-screenshot.svg")
  const trace = resolve(request.outputDirectory, "cytoscape-trace.json")
  const receipt = resolve(request.outputDirectory, "cytoscape-receipt.json")
  await writeSvg(screenshot, geometry)
  await writeFile(trace, JSON.stringify({ protocol: "grapht-cytoscape/0", phases, actions: ["load", "preset", "fit", "pan", "zoom", "select", "dispose"] }, null, 2), "utf8")
  projection.dispose(); phases.disposeMs = performance.now() - interaction - phases.interactionMs
  const value: ProjectionReceipt = { implementation: "cytoscape", request, geometry: { nodeCount: geometry.nodeCount, edgeCount: geometry.edgeCount, hash: geometryHash(geometry) }, phases, selectedId: result.selectedId, camera: result.camera, artifacts: { screenshot, trace, receipt } }
  await writeFile(receipt, JSON.stringify(value, null, 2), "utf8")
  return value
}

export async function runJsonLine(line: string): Promise<string[]> {
  let raw: unknown
  try { raw = JSON.parse(line); const request = benchInputSchema.parse(raw); const startedNs = Number(process.hrtime.bigint()); const value = await runAdapter(request); const endedNs = Number(process.hrtime.bigint()); return [JSON.stringify(sample(request.runId, "interaction", startedNs, endedNs, { nodeCount: value.geometry.nodeCount, edgeCount: value.geometry.edgeCount })), JSON.stringify({ protocol: "grapht-bench/0", type: "result", runId: request.runId, implementation: "cytoscape", operation: request.operation, artifact: value.artifacts.receipt, artifactHash: value.geometry.hash, counters: { nodeCount: value.geometry.nodeCount, edgeCount: value.geometry.edgeCount } })] }
  catch (error) { const runId = typeof raw === "object" && raw !== null && "runId" in raw && typeof raw.runId === "string" ? raw.runId : "unknown"; return [JSON.stringify({ protocol: "grapht-bench/0", type: "error", runId, message: error instanceof Error ? error.message : String(error) })] }
}
