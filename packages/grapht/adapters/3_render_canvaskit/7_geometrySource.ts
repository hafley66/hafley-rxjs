import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import type { Geometry, GeometryManifest } from "./0_protocol.js"
import { createHash } from "node:crypto"

export type Topology = { nodeIds: string[]; edges: [number, number][] }

export const GEOMETRY_SPACING = 48

export function gridPosition(nodeId: string, spacing = GEOMETRY_SPACING): [number, number] {
  const m = /^n(\d+)_(\d+)$/.exec(nodeId)
  if (m) return [Number(m[2]) * spacing, Number(m[1]) * spacing]
  throw new Error(`unsupported node id shape: ${nodeId}`)
}

export function layoutGeometry(topology: Topology): Geometry {
  const positions = new Float32Array(topology.nodeIds.length * 2)
  topology.nodeIds.forEach((id, i) => {
    const [x, y] = gridPosition(id)
    positions[i * 2] = x
    positions[i * 2 + 1] = y
  })
  return {
    nodeIds: topology.nodeIds.slice(),
    positions,
    edges: topology.edges.map(e => [e[0], e[1]] as [number, number]),
    nodeCount: topology.nodeIds.length,
    edgeCount: topology.edges.length,
  }
}

export async function writeGeometry(dir: string, topology: Topology): Promise<GeometryManifest> {
  await mkdir(dir, { recursive: true })
  const geometry = layoutGeometry(topology)

  const nodeIdsRel = "graph.nodeIds.json"
  const edgesRel = "graph.edges.json"
  const positionsRel = "graph.positions.f32le.bin"

  await writeFile(resolve(dir, nodeIdsRel), JSON.stringify(geometry.nodeIds), "utf8")
  await writeFile(resolve(dir, edgesRel), JSON.stringify(geometry.edges), "utf8")
  const bytes = new Uint8Array(geometry.positions.buffer, geometry.positions.byteOffset, geometry.positions.byteLength)
  await writeFile(resolve(dir, positionsRel), bytes)

  const manifest: GeometryManifest = {
    protocol: "grapht-geometry/0",
    nodeIds: nodeIdsRel,
    positions: positionsRel,
    edges: edgesRel,
    nodeCount: geometry.nodeCount,
    edgeCount: geometry.edgeCount,
    scalar: "f32-le",
  }
  await writeFile(resolve(dir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8")
  return manifest
}

export function sha256Hex(bytes: Uint8Array | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex")
}
