import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, join, normalize } from "node:path"
import { GEOMETRY_PROTOCOL, type GeometryManifest } from "./0_protocol.js"

export type CompactGraph = { nodeIds: string[]; edges: Array<[number, number]> }

export function compactGraphToArrays(graph: CompactGraph): { edges: Uint32Array; edgeCount: number; nodeCount: number } {
  const edges = new Uint32Array(graph.edges.length * 2)
  graph.edges.forEach(([source, target], index) => {
    if (!Number.isInteger(source) || !Number.isInteger(target) || source < 0 || target < 0 || source >= graph.nodeIds.length || target >= graph.nodeIds.length) {
      throw new Error(`edge ${index} references a node outside nodeIds`)
    }
    edges[index * 2] = source
    edges[index * 2 + 1] = target
  })
  return { edges, edgeCount: graph.edges.length, nodeCount: graph.nodeIds.length }
}

export function arraysToCompactGraph(nodeIds: string[], edges: Uint32Array): CompactGraph {
  const pairs: Array<[number, number]> = []
  for (let index = 0; index + 1 < edges.length; index += 2) pairs.push([edges[index], edges[index + 1]])
  return { nodeIds: [...nodeIds], edges: pairs }
}

function relativePath(outputDirectory: string, path: string): string {
  if (isAbsolute(path)) throw new Error(`artifact path must be relative: ${path}`)
  const normalized = normalize(path)
  if (normalized === ".." || normalized.startsWith(`..${pathSeparator()}`)) throw new Error(`artifact path escapes output directory: ${path}`)
  return join(outputDirectory, normalized)
}

function pathSeparator(): string { return "/" }

export async function writeGeometry(outputDirectory: string, manifestRel: string, positions: Float32Array, edges: Uint32Array, nodeIds: string[]): Promise<{ manifest: GeometryManifest; hashes: Record<string, string> }> {
  const nodeIdsRel = "nodeIds.txt"
  const positionsRel = "positions.f32"
  const edgesRel = "edges.u32"
  const nodeIdsBuffer = Buffer.from(`${nodeIds.join("\n")}\n`, "utf8")
  const positionsBuffer = Buffer.from(positions.buffer, positions.byteOffset, positions.byteLength)
  const edgesBuffer = Buffer.from(edges.buffer, edges.byteOffset, edges.byteLength)
  await mkdir(outputDirectory, { recursive: true })
  await Promise.all([
    writeFile(relativePath(outputDirectory, nodeIdsRel), nodeIdsBuffer),
    writeFile(relativePath(outputDirectory, positionsRel), positionsBuffer),
    writeFile(relativePath(outputDirectory, edgesRel), edgesBuffer),
  ])
  const manifest: GeometryManifest = {
    protocol: GEOMETRY_PROTOCOL,
    nodeIds: nodeIdsRel,
    positions: positionsRel,
    edges: edgesRel,
    nodeCount: nodeIds.length,
    edgeCount: edges.length / 2,
    scalar: "f32-le",
  }
  const manifestBuffer = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8")
  await writeFile(relativePath(outputDirectory, manifestRel), manifestBuffer)
  return {
    manifest,
    hashes: {
      nodeIds: sha256(nodeIdsBuffer), positions: sha256(positionsBuffer), edges: sha256(edgesBuffer), manifest: sha256(manifestBuffer),
    },
  }
}

export function sha256(data: Uint8Array): string { return createHash("sha256").update(data).digest("hex") }

export function positionsToJson(positions: Float32Array, nodeIds: string[]): string {
  return nodeIds.map((id, index) => `${id} ${positions[index * 2].toFixed(6)} ${positions[index * 2 + 1].toFixed(6)}`).join("\n") + "\n"
}

export async function readGeometryManifest(outputDirectory: string, manifestPath: string): Promise<GeometryManifest> {
  return JSON.parse(await readFile(relativePath(outputDirectory, manifestPath), "utf8")) as GeometryManifest
}
