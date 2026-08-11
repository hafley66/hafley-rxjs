import Graph from "graphology"
import type { Geometry, GeometryManifest } from "./0_protocol.js"

export const DEFAULT_SPACING = 10

export type CommonFixture = {
  protocol: "grapht-render-fixture/0"
  id: string
  nodeCount: number
  edgeCount: number
  nodes: { id: string; x: number; y: number }[]
  edges: [number, number][]
}
export type CommonFixtureLoad = { geometry: Geometry; source: { url: string; bytes: number; sha256: string } }

export function makeFixture(size: number): Geometry {
  const columns = Math.ceil(Math.sqrt(size))
  const nodeIds = Array.from({ length: size }, (_, index) => `n${Math.floor(index / columns)}_${index % columns}`)
  const edges: [number, number][] = []
  for (let index = 0; index < size; index++) {
    if (index % columns !== columns - 1 && index + 1 < size) edges.push([index, index + 1])
    if (index + columns < size) edges.push([index, index + columns])
  }
  const positions = new Float32Array(size * 2)
  for (let index = 0; index < size; index++) {
    positions[index * 2] = index % columns
    positions[index * 2 + 1] = Math.floor(index / columns)
  }
  return { nodeIds, positions, edges }
}

export function parseManifest(text: string): GeometryManifest {
  const parsed = JSON.parse(text) as GeometryManifest
  if (parsed.protocol !== "grapht-geometry/0") {
    throw new Error(`expected grapht-geometry/0 manifest, got ${parsed.protocol}`)
  }
  return parsed
}

export function decodePositions(buffer: ArrayBuffer): Float32Array {
  if (buffer.byteLength % 4 !== 0) {
    throw new Error(`positions byte length must be divisible by four, got ${buffer.byteLength}`)
  }
  const view = new DataView(buffer)
  const positions = new Float32Array(buffer.byteLength / 4)
  for (let i = 0; i < positions.length; i++) {
    positions[i] = view.getFloat32(i * 4, true)
  }
  return positions
}

export async function loadGeometry(fixture: string, basePath = "/geometry"): Promise<Geometry> {
  const manifest = parseManifest(await (await fetch(`${basePath}/${fixture}/manifest.json`)).text())
  const nodeIds = JSON.parse(await (await fetch(`${basePath}/${fixture}/${manifest.nodeIds}`)).text()) as string[]
  const edges = JSON.parse(await (await fetch(`${basePath}/${fixture}/${manifest.edges}`)).text()) as [number, number][]
  const positions = decodePositions(await (await fetch(`${basePath}/${fixture}/${manifest.positions}`)).arrayBuffer())
  if (nodeIds.length !== manifest.nodeCount) {
    throw new Error(`node count mismatch: manifest=${manifest.nodeCount}, data=${nodeIds.length}`)
  }
  if (edges.length !== manifest.edgeCount) {
    throw new Error(`edge count mismatch: manifest=${manifest.edgeCount}, data=${edges.length}`)
  }
  if (positions.length !== nodeIds.length * 2) {
    throw new Error(`position count mismatch: expected=${nodeIds.length * 2}, data=${positions.length}`)
  }
  return { nodeIds, positions, edges }
}

async function sha256(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("")
}

export async function loadCommonFixture(size: number, baseUrl = "/common-fixtures"): Promise<CommonFixtureLoad> {
  const url = `${baseUrl}/grid-${size}.json`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`common fixture request failed: ${response.status} ${url}`)
  const bytes = await response.arrayBuffer()
  const parsed = JSON.parse(new TextDecoder().decode(bytes)) as CommonFixture
  if (parsed.protocol !== "grapht-render-fixture/0" || parsed.id !== `grid-${size}`) throw new Error(`invalid common fixture identity: ${url}`)
  if (parsed.nodeCount !== parsed.nodes.length || parsed.edgeCount !== parsed.edges.length) throw new Error(`common fixture manifest count mismatch: ${url}`)
  const nodeIds = parsed.nodes.map(node => node.id)
  const positions = new Float32Array(parsed.nodes.length * 2)
  for (let index = 0; index < parsed.nodes.length; index++) { positions[index * 2] = parsed.nodes[index].x; positions[index * 2 + 1] = parsed.nodes[index].y }
  return { geometry: { nodeIds, positions, edges: parsed.edges }, source: { url, bytes: bytes.byteLength, sha256: await sha256(bytes) } }
}

function nodeSize(degree: number): number {
  return Math.min(10, 2 + Math.sqrt(degree))
}

export function buildGraph(geometry: Geometry): Graph {
  const graph = new Graph()
  const { nodeIds, positions, edges } = geometry
  for (let i = 0; i < nodeIds.length; i++) {
    graph.addNode(nodeIds[i], {
      x: positions[i * 2],
      y: positions[i * 2 + 1],
      size: 1,
      label: nodeIds[i],
      color: "#4a7fdf",
    })
  }
  const degree = new Map<string, number>()
  for (const [a, b] of edges) {
    graph.addUndirectedEdge(nodeIds[a], nodeIds[b])
    degree.set(nodeIds[a], (degree.get(nodeIds[a]) ?? 0) + 1)
    degree.set(nodeIds[b], (degree.get(nodeIds[b]) ?? 0) + 1)
  }
  for (const node of nodeIds) {
    graph.setNodeAttribute(node, "size", nodeSize(degree.get(node) ?? 0))
  }
  return graph
}
