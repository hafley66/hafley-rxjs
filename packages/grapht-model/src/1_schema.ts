import { z } from "zod"
import { GRAPH_MODEL_PROTOCOL } from "./0_types.js"

const id = z.string().min(1)
const sourceSpanSchema = z.object({
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
  lineStart: z.number().int().positive().optional(),
  lineEnd: z.number().int().positive().optional(),
})
const rectSchema = z.object({ x: z.number(), y: z.number(), width: z.number().nonnegative(), height: z.number().nonnegative() })
const pointSchema = z.object({ x: z.number(), y: z.number() })
const matrixSchema = z.tuple([z.number(), z.number(), z.number(), z.number(), z.number(), z.number()])

export const graphEntitySchema = z.object({
  id,
  kind: z.enum(["actor", "message", "activation", "group", "note", "node", "edge"]),
  label: z.string().optional(),
  parentId: id.optional(),
  sourceKey: z.string().optional(),
  ordinal: z.number().int().nonnegative(),
  sourceSpan: sourceSpanSchema.optional(),
  metadata: z.record(z.string(), z.string()).optional(),
})

export const graphRelationSchema = z.object({
  id,
  kind: z.enum(["message", "edge", "contains", "activates", "branch"]),
  sourceId: id,
  targetId: id,
  parentId: id.optional(),
  ordinal: z.number().int().nonnegative(),
})

export const graphTopologySchema = z.object({
  language: z.string().min(1),
  entities: z.array(graphEntitySchema),
  relations: z.array(graphRelationSchema),
  sourceSpans: z.array(sourceSpanSchema),
})

export const svgBindingSchema = z.object({
  entityId: id,
  elementId: id,
  role: z.enum(["shape", "label", "path", "marker", "lifeline", "frame"]),
  ordinal: z.number().int().nonnegative(),
})

export const sourceRevisionSchema = z.object({
  id,
  artifactId: id,
  parentIds: z.array(id),
  locator: z.string().min(1),
  sourceHash: id,
  adapterId: id,
  identityVersion: id,
})

export const renderRevisionSchema = z.object({
  id,
  sourceRevisionId: id,
  optionsHash: id,
  rawSvg: z.string(),
  decoratedSvg: z.string(),
  bindings: z.array(svgBindingSchema),
})

export const entityGeometrySchema = z.object({
  entityId: id,
  localBounds: rectSchema,
  worldBounds: rectSchema,
  transform: matrixSchema.optional(),
  path: z.array(pointSchema).optional(),
  sourceSvgElementIds: z.array(id),
})

export const geometrySnapshotSchema = z.object({
  id,
  renderRevisionId: id,
  coordinateSpace: z.literal("svg-viewBox"),
  viewBox: rectSchema,
  entities: z.array(entityGeometrySchema),
})

export const boardPlacementSchema = z.object({
  viewId: id,
  entityId: id,
  baseGeometryRevisionId: id,
  rect: rectSchema,
  source: z.enum(["auto-layout", "manual"]),
  policy: z.enum(["absolute", "delta-from-layout"]),
})

export const boardRevisionSchema = z.object({
  id,
  graphRevisionId: id,
  placements: z.array(boardPlacementSchema),
  collapsedGroupIds: z.array(id),
})

export const modelReceiptSchema = z.object({
  protocol: z.literal(GRAPH_MODEL_PROTOCOL),
  sourceRevisionId: id,
  renderRevisionId: id,
  geometryRevisionId: id,
  retained: z.array(id),
  inserted: z.array(id),
  removed: z.array(id),
  ambiguous: z.array(id),
})

export function parseGraphTopology(input: unknown) {
  return graphTopologySchema.parse(input)
}

export function parseGeometrySnapshot(input: unknown) {
  return geometrySnapshotSchema.parse(input)
}
