import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { isAbsolute, join, normalize } from "node:path"
import { GEOMETRY_PROTOCOL, type GeometryManifest } from "./0_protocol.js"
export type CompactGraph = { nodeIds: string[]; edges: Array<[number, number]> }
function outputPath(directory: string, path: string): string {
  if (isAbsolute(path)) throw new Error(`artifact path must be relative: ${path}`)
  const normalized = normalize(path)
  if (normalized === ".." || normalized.startsWith(`..${"/"}`)) throw new Error(`artifact path escapes output directory: ${path}`)
  return join(directory, normalized)
}
export function compactGraphToArrays(graph: CompactGraph): { edges: Uint32Array; nodeCount: number; edgeCount: number } {
  const edges = new Uint32Array(graph.edges.length * 2)
  graph.edges.forEach(([source, target], index) => { if (source < 0 || target < 0 || source >= graph.nodeIds.length || target >= graph.nodeIds.length) throw new Error(`edge ${index} references a node outside nodeIds`); edges[index * 2] = source; edges[index * 2 + 1] = target })
  return { edges, nodeCount: graph.nodeIds.length, edgeCount: graph.edges.length }
}
export function writeGeometry(outputDirectory: string, positions: Float32Array, edges: Uint32Array, nodeIds: string[]): Promise<{ manifest: GeometryManifest; hashes: Record<string, string> }> {
  const nodeIdsBuffer = Buffer.from(`${nodeIds.join("\n")}\n`)
  const positionsBuffer = Buffer.from(positions.buffer, positions.byteOffset, positions.byteLength)
  const edgesBuffer = Buffer.from(edges.buffer, edges.byteOffset, edges.byteLength)
  const manifest: GeometryManifest = { protocol: GEOMETRY_PROTOCOL, nodeIds: "nodeIds.txt", positions: "positions.f32", edges: "edges.u32", nodeCount: nodeIds.length, edgeCount: edges.length / 2, scalar: "f32-le" }
  const manifestBuffer = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`)
  return mkdir(outputDirectory, { recursive: true }).then(() => Promise.all([writeFile(outputPath(outputDirectory, manifest.nodeIds), nodeIdsBuffer), writeFile(outputPath(outputDirectory, manifest.positions), positionsBuffer), writeFile(outputPath(outputDirectory, manifest.edges), edgesBuffer), writeFile(outputPath(outputDirectory, "geometry.manifest.json"), manifestBuffer)])).then(() => ({ manifest, hashes: { nodeIds: sha256(nodeIdsBuffer), positions: sha256(positionsBuffer), edges: sha256(edgesBuffer), manifest: sha256(manifestBuffer) } }))
}
export function sha256(data: Uint8Array): string { return createHash("sha256").update(data).digest("hex") }
export function positionsToJson(positions: Float32Array, nodeIds: string[]): string { return nodeIds.map((id, index) => `${id} ${positions[index * 2].toFixed(6)} ${positions[index * 2 + 1].toFixed(6)}`).join("\n") + "\n" }
export async function readGeometryManifest(directory: string): Promise<GeometryManifest> { return JSON.parse(await readFile(outputPath(directory, "geometry.manifest.json"), "utf8")) as GeometryManifest }
