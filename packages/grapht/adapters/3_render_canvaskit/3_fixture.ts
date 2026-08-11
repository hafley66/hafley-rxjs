import type { Geometry } from "./0_protocol.js"

export type CommonFixture = {
  protocol: "grapht-render-fixture/0"
  id: string
  nodeCount: number
  edgeCount: number
  nodes: { id: string; x: number; y: number }[]
  edges: [number, number][]
}
export type CommonFixtureLoad = { geometry: Geometry; source: { url: string; bytes: number; sha256: string } }

export type FixtureSize = number

export function fixtureSize(name: string): FixtureSize {
  const match = /(?:grid[-_])?(\d+(?:\.\d+)?)(k|m)?$/i.exec(name)
  if (!match) throw new Error(`unsupported fixture ${name}`)
  const multiplier = match[2]?.toLowerCase() === "m" ? 1_000_000 : match[2] ? 1_000 : 1
  const value = Math.round(Number(match[1]) * multiplier)
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`invalid fixture size ${name}`)
  return value
}

export function makeFixture(size: FixtureSize): Geometry {
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
  return { nodeIds, positions, edges, nodeCount: size, edgeCount: edges.length }
}

async function sha256(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("")
}

export async function loadCommonFixture(size: FixtureSize, baseUrl = "/common-fixtures"): Promise<CommonFixtureLoad> {
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
  return { geometry: { nodeIds, positions, edges: parsed.edges, nodeCount: nodeIds.length, edgeCount: parsed.edges.length }, source: { url, bytes: bytes.byteLength, sha256: await sha256(bytes) } }
}
