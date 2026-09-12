import { descendantsOf, documentFingerprint, type Graph, type GraphId } from "@hafley66/grapht-model"
import type { GraphGeometry } from "./0_frame.js"
import type { Rect } from "../1_sequence/3_geometry.js"

export type SealedGeometryFit = "contain"

export type SealedGeometryScope = {
  rootId: GraphId
  geometry: GraphGeometry
  fit: SealedGeometryFit
}

export type SealedGeometryTransform = {
  scaleX: number
  scaleY: number
  translateX: number
  translateY: number
}

function assertFiniteRect(bounds: Rect, scope: "source" | "target"): void {
  if (!Number.isFinite(bounds.x) || !Number.isFinite(bounds.y) || !Number.isFinite(bounds.width) || !Number.isFinite(bounds.height)) {
    throw new Error(`sealed geometry ${scope} bounds must have finite coordinates and dimensions`)
  }
}

export function sealedGeometryTransformOf(source: Rect, target: Rect, fit: SealedGeometryFit): SealedGeometryTransform {
  assertFiniteRect(source, "source")
  assertFiniteRect(target, "target")
  if (source.width <= 0 || source.height <= 0) throw new Error("sealed geometry source bounds must have positive width and height")
  if (target.width <= 0 || target.height <= 0) throw new Error("sealed geometry target bounds must have positive width and height")

  switch (fit) {
    case "contain": {
      const scale = Math.min(target.width / source.width, target.height / source.height)
      return {
        scaleX: scale,
        scaleY: scale,
        translateX: target.x + (target.width - source.width * scale) / 2 - source.x * scale,
        translateY: target.y + (target.height - source.height * scale) / 2 - source.y * scale,
      }
    }
  }
}

function transformRect(bounds: Rect, transform: SealedGeometryTransform): Rect {
  return {
    x: bounds.x * transform.scaleX + transform.translateX,
    y: bounds.y * transform.scaleY + transform.translateY,
    width: bounds.width * transform.scaleX,
    height: bounds.height * transform.scaleY,
  }
}

function transformPoint(point: { x: number; y: number }, transform: SealedGeometryTransform): { x: number; y: number } {
  return {
    x: point.x * transform.scaleX + transform.translateX,
    y: point.y * transform.scaleY + transform.translateY,
  }
}

function transformRoute(route: Float32Array, transform: SealedGeometryTransform): Float32Array {
  if (route.length % 2 !== 0) throw new Error("sealed geometry route must contain x/y coordinate pairs")
  const transformed = new Float32Array(route.length)
  for (let index = 0; index < route.length; index += 2) {
    transformed[index] = route[index] * transform.scaleX + transform.translateX
    transformed[index + 1] = route[index + 1] * transform.scaleY + transform.translateY
  }
  return transformed
}

function mergeRecords<Value>(
  target: Record<GraphId, Value>,
  source: Readonly<Record<GraphId, Value>>,
  descendantIds: ReadonlySet<GraphId>,
  rootId: GraphId,
  category: string,
  project: (value: Value) => Value,
): void {
  for (const id of Object.keys(source).sort()) {
    if (!descendantIds.has(id)) throw new Error(`sealed geometry scope ${rootId} contains non-descendant ${category} ${id}`)
    if (Object.hasOwn(target, id)) throw new Error(`sealed geometry collision for ${category} ${id} in scope ${rootId}`)
    target[id] = project(source[id])
  }
}

function composeScope(
  target: Omit<GraphGeometry, "revisionId">,
  graph: Graph,
  scope: SealedGeometryScope,
): void {
  const root = graph[scope.rootId]
  if (root?.type !== "node" || root.layout?.mode !== "sealed") {
    throw new Error(`sealed geometry scope ${scope.rootId} requires a sealed graph node`)
  }
  if (scope.geometry.revisionId !== root.layout.geometryRevisionId) {
    throw new Error(`sealed geometry scope ${scope.rootId} revision ${scope.geometry.revisionId} does not match sealed geometry revision ${root.layout.geometryRevisionId}`)
  }
  const targetBounds = target.boundsById[scope.rootId]
  if (targetBounds === undefined) throw new Error(`sealed geometry scope ${scope.rootId} has no outer bounds`)

  const transform = sealedGeometryTransformOf(root.layout.bounds, targetBounds, scope.fit)
  const descendantIds = new Set(descendantsOf(graph, scope.rootId))

  mergeRecords(target.boundsById, scope.geometry.boundsById, descendantIds, scope.rootId, "bounds", bounds => transformRect(bounds, transform))
  mergeRecords(target.endpointAnchorById, scope.geometry.endpointAnchorById, descendantIds, scope.rootId, "endpoint anchor", point => transformPoint(point, transform))
  mergeRecords(target.routesById, scope.geometry.routesById, descendantIds, scope.rootId, "route", route => transformRoute(route, transform))
  mergeRecords(target.headerBoundsById, scope.geometry.headerBoundsById, descendantIds, scope.rootId, "header bounds", bounds => transformRect(bounds, transform))
}

/**
 * Places native descendant geometry for sealed graph roots into outer-layout
 * coordinates. The source geometry remains unchanged and can be reused by its
 * native renderer.
 */
export function composeGraphGeometryScopes(outer: GraphGeometry, graph: Graph, scopes: readonly SealedGeometryScope[]): GraphGeometry {
  const orderedScopes = [...scopes].sort((left, right) => left.rootId.localeCompare(right.rootId))
  for (let index = 1; index < orderedScopes.length; index++) {
    if (orderedScopes[index - 1].rootId === orderedScopes[index].rootId) {
      throw new Error(`duplicate sealed geometry scope root ${orderedScopes[index].rootId}`)
    }
  }

  const target = {
    boundsById: { ...outer.boundsById },
    endpointAnchorById: { ...outer.endpointAnchorById },
    routesById: { ...outer.routesById },
    headerBoundsById: { ...outer.headerBoundsById },
  }

  for (const scope of orderedScopes) composeScope(target, graph, scope)

  return {
    revisionId: `geometry:composed:${documentFingerprint([outer.revisionId, orderedScopes.map(scope => {
      const root = graph[scope.rootId]
      if (root?.type !== "node" || root.layout?.mode !== "sealed") throw new Error(`sealed geometry scope ${scope.rootId} requires a sealed graph node`)
      return [
        scope.geometry.revisionId,
        scope.rootId,
        scope.fit,
        root.layout.bounds.x,
        root.layout.bounds.y,
        root.layout.bounds.width,
        root.layout.bounds.height,
      ]
    })])}`,
    ...target,
  }
}
