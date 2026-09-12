import { z } from "zod"

export const RENDER_FIXTURE_PROTOCOL = "grapht-render-fixture/0"

export const rendererFixtureNodeSchema = z.object({
  id: z.string().min(1),
  x: z.number().finite(),
  y: z.number().finite(),
})

export const rendererFixtureSchema = z.object({
  protocol: z.literal(RENDER_FIXTURE_PROTOCOL),
  id: z.string().min(1),
  nodeCount: z.number().int().positive(),
  edgeCount: z.number().int().nonnegative(),
  nodes: z.array(rendererFixtureNodeSchema),
  edges: z.array(z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()])),
}).superRefine((fixture, context) => {
  if (fixture.nodeCount !== fixture.nodes.length) context.addIssue({ code: "custom", path: ["nodes"], message: "nodeCount must equal nodes.length" })
  if (fixture.edgeCount !== fixture.edges.length) context.addIssue({ code: "custom", path: ["edges"], message: "edgeCount must equal edges.length" })
  for (const [index, [source, target]] of fixture.edges.entries()) {
    if (source >= fixture.nodeCount || target >= fixture.nodeCount) context.addIssue({ code: "custom", path: ["edges", index], message: "edge endpoint is outside nodes" })
  }
})

export type RendererFixture = z.infer<typeof rendererFixtureSchema>

export type RendererFixtureMemory = {
  positionBytes: number
  numericIdBytes: number
  edgeEndpointBytes: number
  packedRenderBytes: number
}

export function rendererFixtureMemory(nodeCount: number, edgeCount: number): RendererFixtureMemory {
  const positionBytes = nodeCount * 2 * Float32Array.BYTES_PER_ELEMENT
  const numericIdBytes = nodeCount * Uint32Array.BYTES_PER_ELEMENT
  const edgeEndpointBytes = edgeCount * 2 * Uint32Array.BYTES_PER_ELEMENT
  return {
    positionBytes,
    numericIdBytes,
    edgeEndpointBytes,
    packedRenderBytes: positionBytes + numericIdBytes + edgeEndpointBytes,
  }
}
