import { documentFingerprint, type Graph, type GraphId, type GraphPoint } from "@hafley66/grapht-model"
import type { GraphGeometry } from "./0_frame.js"

export type GraphTranslations = Readonly<Record<GraphId, GraphPoint>>

function translated(point: GraphPoint, delta: GraphPoint | undefined): GraphPoint {
  return delta === undefined ? point : { x: point.x + delta.x, y: point.y + delta.y }
}

export function translateGraphGeometry(graph: Graph, geometry: GraphGeometry, translations: GraphTranslations): GraphGeometry {
  const entries = Object.entries(translations).filter(([, delta]) => delta.x !== 0 || delta.y !== 0).sort(([left], [right]) => left.localeCompare(right))
  if (entries.length === 0) return geometry
  const boundsById = { ...geometry.boundsById }
  const endpointAnchorById = { ...geometry.endpointAnchorById }
  const headerBoundsById = { ...geometry.headerBoundsById }
  const routesById = { ...geometry.routesById }
  for (const [id, delta] of entries) {
    const bounds = boundsById[id]
    if (bounds !== undefined) boundsById[id] = { ...bounds, x: bounds.x + delta.x, y: bounds.y + delta.y }
    const anchor = endpointAnchorById[id]
    if (anchor !== undefined) endpointAnchorById[id] = translated(anchor, delta)
    const header = headerBoundsById[id]
    if (header !== undefined) headerBoundsById[id] = { ...header, x: header.x + delta.x, y: header.y + delta.y }
  }
  for (const item of Object.values(graph)) {
    if (item.type !== "edge") continue
    const route = routesById[item.id]
    if (route === undefined || route.length < 4) continue
    const next = new Float32Array(route)
    const from = translations[item.fromId]
    const to = translations[item.toId]
    if (item.fromId === item.toId && from !== undefined) {
      for (let index = 0; index < next.length; index += 2) {
        next[index] += from.x
        next[index + 1] += from.y
      }
      routesById[item.id] = next
      continue
    }
    if (from !== undefined) {
      next[0] += from.x
      next[1] += from.y
    }
    if (to !== undefined) {
      next[next.length - 2] += to.x
      next[next.length - 1] += to.y
    }
    routesById[item.id] = next
  }
  return {
    revisionId: `geometry:translated:${documentFingerprint([geometry.revisionId, entries])}`,
    boundsById,
    endpointAnchorById,
    routesById,
    headerBoundsById,
  }
}
