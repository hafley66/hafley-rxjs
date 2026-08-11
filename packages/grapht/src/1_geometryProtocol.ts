import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { z } from "zod"

export const geometryManifestSchema = z.object({
  protocol: z.literal("grapht-geometry/0"),
  nodeIds: z.string().min(1),
  positions: z.string().min(1),
  edges: z.string().min(1),
  nodeCount: z.number().int().nonnegative(),
  edgeCount: z.number().int().nonnegative(),
  scalar: z.literal("f32-le"),
})
export type GeometryManifest = z.infer<typeof geometryManifestSchema>

export function parseGeometryManifest(text: string): GeometryManifest {
  return geometryManifestSchema.parse(JSON.parse(text) as unknown)
}

export type Geometry = {
  nodeIds: string[]
  positions: Float32Array
  edges: [number, number][]
}

export function geometryOf(topology: { nodeIds: string[]; edges: [number, number][] }): Geometry {
  const positions = new Float32Array(topology.nodeIds.length * 2)
  return {
    nodeIds: topology.nodeIds.slice(),
    positions,
    edges: topology.edges.map(edge => [edge[0], edge[1]] as [number, number]),
  }
}

export async function writeGeometry(dir: string, geometry: Geometry, prefix = "graph"): Promise<GeometryManifest> {
  await mkdir(dir, { recursive: true })

  const nodeIdsText = JSON.stringify(geometry.nodeIds)
  const edgesText = JSON.stringify(geometry.edges)
  const nodeIdsRel = `${prefix}.nodeIds.json`
  const edgesRel = `${prefix}.edges.json`
  const positionsRel = `${prefix}.positions.f32le.bin`

  await writeFile(resolve(dir, nodeIdsRel), nodeIdsText, "utf8")
  await writeFile(resolve(dir, edgesRel), edgesText, "utf8")
  const positionBytes = new Uint8Array(
    geometry.positions.buffer,
    geometry.positions.byteOffset,
    geometry.positions.byteLength,
  )
  await writeFile(resolve(dir, positionsRel), positionBytes)

  const manifest: GeometryManifest = {
    protocol: "grapht-geometry/0",
    nodeIds: nodeIdsRel,
    positions: positionsRel,
    edges: edgesRel,
    nodeCount: geometry.nodeIds.length,
    edgeCount: geometry.edges.length,
    scalar: "f32-le",
  }
  await writeFile(resolve(dir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8")
  return manifest
}
