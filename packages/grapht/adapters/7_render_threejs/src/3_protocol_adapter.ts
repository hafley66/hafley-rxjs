import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { BENCH_PROTOCOL, type BenchInput, type BenchOutput } from "../../../src/0_benchProtocol.js"
import { RENDER_FIXTURE_PROTOCOL, type RendererFixture } from "../../../src/10_rendererFixture.js"
import { fixtureSize } from "./1_fixture.js"

const here = dirname(fileURLToPath(import.meta.url))
const cacheRoot = resolve(here, "..", "..", "..", ".cache", "render-fixtures")

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
    throw new Error(`Three.js accepts render or interaction, got ${request.operation}`)
  }
  return request
}

async function readCommonFixture(fixture: string): Promise<{ fixture: RendererFixture; bytes: number }> {
  const size = fixtureSize(fixture)
  const path = resolve(cacheRoot, `grid-${size}.json`)
  if (!path.startsWith(`${cacheRoot}/`)) throw new Error(`invalid fixture path: ${fixture}`)
  const bytes = await readFile(path)
  const value = JSON.parse(bytes.toString("utf8")) as RendererFixture
  if (value.protocol !== RENDER_FIXTURE_PROTOCOL) throw new Error(`expected ${RENDER_FIXTURE_PROTOCOL}`)
  if (value.nodeCount !== value.nodes.length || value.edgeCount !== value.edges.length) {
    throw new Error(`common fixture manifest count mismatch: ${path}`)
  }
  return { fixture: value, bytes: bytes.byteLength }
}

async function run(request: BenchInput): Promise<BenchOutput[]> {
  const outputs: BenchOutput[] = []
  const loadStarted = nowNs()
  const { fixture, bytes } = await readCommonFixture(request.fixture)
  outputs.push(sample(request.runId, "load", loadStarted, {
    nodeCount: fixture.nodeCount,
    edgeCount: fixture.edgeCount,
    fixtureBytes: bytes,
  }))

  const importStarted = nowNs()
  const positions = new Float32Array(fixture.nodes.length * 2)
  for (let index = 0; index < fixture.nodes.length; index++) {
    positions[index * 2] = fixture.nodes[index].x
    positions[index * 2 + 1] = fixture.nodes[index].y
  }
  outputs.push(sample(request.runId, "import", importStarted, { nodes: fixture.nodeCount, edges: fixture.edgeCount, positionBytes: positions.byteLength }))

  const renderer = typeof request.parameters.renderer === "string" ? request.parameters.renderer : "webgl"
  const representation = typeof request.parameters.representation === "string" ? request.parameters.representation : "retained"
  const outputDirectory = resolve(request.outputDirectory)
  await mkdir(outputDirectory, { recursive: true })
  const geometryHash = createHash("sha256").update(new Uint8Array(positions.buffer, positions.byteOffset, positions.byteLength)).update(JSON.stringify(fixture.nodes.map(node => node.id))).update(JSON.stringify(fixture.edges)).digest("hex")
  const receipt = {
    protocol: "grapht-threejs-receipt/0",
    implementation: "threejs",
    fixture: request.fixture,
    operation: request.operation,
    renderer,
    representation,
    geometryHash,
    nodeCount: fixture.nodeCount,
    edgeCount: fixture.edgeCount,
    browserLab: "pnpm lab",
  }
  const artifactName = `threejs-${request.fixture}.receipt.json`
  await writeFile(join(outputDirectory, artifactName), `${JSON.stringify(receipt, null, 2)}\n`, "utf8")
  outputs.push({
    protocol: BENCH_PROTOCOL,
    type: "result",
    runId: request.runId,
    implementation: "threejs",
    operation: request.operation,
    artifact: artifactName,
    artifactHash: createHash("sha256").update(JSON.stringify(receipt)).digest("hex"),
    counters: { nodes: fixture.nodeCount, edges: fixture.edgeCount, positionBytes: positions.byteLength },
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
