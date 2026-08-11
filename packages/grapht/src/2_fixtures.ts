import { randomUUID } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { BENCH_PROTOCOL, type BenchInput, type BenchOperation } from "./0_benchProtocol.js"

export type GridFixtureDef = {
  id: string
  kind: "grid"
  rows: number
  cols: number
  seed: number
}

export type FixtureDef = GridFixtureDef

export type Topology = {
  nodeIds: string[]
  edges: [number, number][]
}

export function packageRoot(fromImportMetaUrl: string): string {
  return resolve(dirname(fileURLToPath(fromImportMetaUrl)), "..")
}

export function fixturesDir(fromImportMetaUrl: string): string {
  return resolve(packageRoot(fromImportMetaUrl), "fixtures")
}

export function gridTopology(rows: number, cols: number, _seed: number): Topology {
  const nodeIds: string[] = []
  const index = new Map<string, number>()
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = `n${r}_${c}`
      index.set(id, nodeIds.length)
      nodeIds.push(id)
    }
  }
  const edges: [number, number][] = []
  const edge = (a: number, b: number): void => {
    if (a < b) edges.push([a, b])
    else edges.push([b, a])
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cur = index.get(`n${r}_${c}`) as number
      if (c + 1 < cols) edge(cur, index.get(`n${r}_${c + 1}`) as number)
      if (r + 1 < rows) edge(cur, index.get(`n${r + 1}_${c}`) as number)
    }
  }
  return { nodeIds, edges }
}

export async function loadFixtureDefs(fromImportMetaUrl: string): Promise<FixtureDef[]> {
  const dir = fixturesDir(fromImportMetaUrl)
  const files = (await readdir(dir)).filter(file => file.endsWith(".json")).sort()
  const defs: FixtureDef[] = []
  for (const file of files) {
    const raw = await readFile(resolve(dir, file), "utf8")
    const parsed = JSON.parse(raw) as FixtureDef
    if (typeof parsed?.id !== "string" || parsed.kind !== "grid") continue
    defs.push(parsed)
  }
  return defs
}

export async function resolveFixtureDef(name: string, fromImportMetaUrl: string): Promise<FixtureDef> {
  const defs = await loadFixtureDefs(fromImportMetaUrl)
  const def = defs.find(candidate => candidate.id === name)
  if (!def) {
    throw new Error(`unknown fixture ${name}; known fixtures: ${defs.map(d => d.id).join(", ")}`)
  }
  return def
}

export async function makeBenchInput(
  fixtureName: string,
  fromImportMetaUrl: string,
  operation: BenchOperation = "layout",
): Promise<BenchInput> {
  const fixture = await resolveFixtureDef(fixtureName, fromImportMetaUrl)
  const topology = gridTopology(fixture.rows, fixture.cols, fixture.seed)
  return {
    protocol: BENCH_PROTOCOL,
    runId: randomUUID(),
    fixture: fixture.id,
    operation,
    input: JSON.stringify(topology),
    outputDirectory: ".",
    parameters: {},
  }
}
