import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { buildGraph } from "./1_graphology.js"
import {
  BENCH_PROTOCOL,
  GEOMETRY_PROTOCOL,
  type BenchInput,
  type BenchOutput,
  type GeometryManifest,
} from "./0_protocol.js"

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const fixtureRoot = resolve(packageRoot, "fixtures", "geometry")

function nowNs(): number {
  return Number(process.hrtime.bigint())
}

function sample(runId: string, phase: string, startedNs: number, counters: Record<string, number>): BenchOutput {
  return {
    protocol: BENCH_PROTOCOL,
    type: "sample",
    runId,
    phase,
    startedNs,
    endedNs: nowNs(),
    counters,
  }
}

function requestError(runId: string, message: string): BenchOutput {
  return { protocol: BENCH_PROTOCOL, type: "error", runId, message }
}

function parseRequest(text: string): BenchInput {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  if (lines.length !== 1) throw new Error(`expected one JSONL request, got ${lines.length}`)
  const request = JSON.parse(lines[0]) as BenchInput
  if (request.protocol !== BENCH_PROTOCOL) throw new Error(`expected ${BENCH_PROTOCOL}`)
  if (!request.runId) throw new Error("runId is required")
  if (!request.fixture) throw new Error("fixture is required")
  if (request.operation !== "render" && request.operation !== "interaction") {
    throw new Error(`Sigma accepts render or interaction, got ${request.operation}`)
  }
  return request
}

async function readGeometry(fixture: string): Promise<{
  manifest: GeometryManifest
  nodeIds: string[]
  edges: [number, number][]
  positions: Buffer
}> {
  const root = resolve(fixtureRoot, fixture)
  if (!root.startsWith(`${fixtureRoot}/`)) throw new Error(`invalid fixture path: ${fixture}`)
  const manifest = JSON.parse(await readFile(resolve(root, "manifest.json"), "utf8")) as GeometryManifest
  if (manifest.protocol !== GEOMETRY_PROTOCOL) throw new Error(`expected ${GEOMETRY_PROTOCOL}`)
  const nodeIds = JSON.parse(await readFile(resolve(root, manifest.nodeIds), "utf8")) as string[]
  const edges = JSON.parse(await readFile(resolve(root, manifest.edges), "utf8")) as [number, number][]
  const positions = await readFile(resolve(root, manifest.positions))
  if (nodeIds.length !== manifest.nodeCount) throw new Error("node count does not match manifest")
  if (edges.length !== manifest.edgeCount) throw new Error("edge count does not match manifest")
  if (positions.byteLength !== nodeIds.length * 2 * 4) throw new Error("position bytes do not match node count")
  return { manifest, nodeIds, edges, positions }
}

async function run(request: BenchInput): Promise<BenchOutput[]> {
  const outputs: BenchOutput[] = []
  const loadStarted = nowNs()
  const geometry = await readGeometry(request.fixture)
  outputs.push(sample(request.runId, "load", loadStarted, {
    nodeCount: geometry.nodeIds.length,
    edgeCount: geometry.edges.length,
    positionBytes: geometry.positions.byteLength,
  }))

  const importStarted = nowNs()
  const graph = buildGraph({
    nodeIds: geometry.nodeIds,
    edges: geometry.edges,
    positions: new Float32Array(geometry.positions.buffer, geometry.positions.byteOffset, geometry.positions.byteLength / 4),
  })
  outputs.push(sample(request.runId, "import", importStarted, { nodes: graph.order, edges: graph.size }))

  const outputDirectory = resolve(request.outputDirectory)
  await mkdir(outputDirectory, { recursive: true })
  const geometryHash = createHash("sha256").update(geometry.positions).update(JSON.stringify(geometry.nodeIds)).update(JSON.stringify(geometry.edges)).digest("hex")
  const receipt = {
    protocol: "grapht-sigma-receipt/0",
    implementation: "sigma",
    fixture: request.fixture,
    operation: request.operation,
    geometryHash,
    nodeCount: graph.order,
    edgeCount: graph.size,
    browserLab: "pnpm lab",
  }
  const artifactName = `sigma-${request.fixture}.receipt.json`
  await writeFile(resolve(outputDirectory, artifactName), `${JSON.stringify(receipt, null, 2)}\n`, "utf8")
  outputs.push({
    protocol: BENCH_PROTOCOL,
    type: "result",
    runId: request.runId,
    implementation: "sigma",
    operation: request.operation,
    artifact: artifactName,
    artifactHash: createHash("sha256").update(JSON.stringify(receipt)).digest("hex"),
    counters: { nodes: graph.order, edges: graph.size, positionBytes: geometry.positions.byteLength },
  })
  return outputs
}

const input = await new Promise<string>((resolveInput, reject) => {
  let text = ""
  process.stdin.setEncoding("utf8")
  process.stdin.on("data", chunk => { text += chunk })
  process.stdin.on("end", () => resolveInput(text))
  process.stdin.on("error", reject)
})

try {
  const request = parseRequest(input)
  for (const output of await run(request)) process.stdout.write(`${JSON.stringify(output)}\n`)
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  process.stdout.write(`${JSON.stringify(requestError("unknown", message))}\n`)
  process.exitCode = 1
}
