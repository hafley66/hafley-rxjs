import type { GraphFrame } from "./0_frame.js"
import { svgGraphPrimitivesOf } from "./4_svgGeometry.js"
import { collapseGraphFrame } from "./17_groupProjection.js"

/** Compact collapsed sequence fragments in source coordinates, retaining one header row.
 * Both renderers consume the same projected SVG and geometry. The input artifact and its source
 * remain unchanged; expansion simply projects again from the original frame.
 */
export function collapseSequenceFrame(document: Document, frame: GraphFrame, collapsed: ReadonlySet<string>): GraphFrame {
  const next = collapseGraphFrame(frame, collapsed)
  if (!collapsed.size) return next
  const intervals = [...collapsed].filter(id => !next.presentation.hiddenIds.has(id))
    .map(id => frame.geometry.boundsById[id]).filter(bounds => bounds && bounds.height > 30)
    .map(bounds => ({ start: bounds.y + 30, end: bounds.y + bounds.height })).sort((a, b) => a.start - b.start)
  const merged: typeof intervals = []
  for (const interval of intervals) {
    const previous = merged.at(-1)
    if (previous && interval.start <= previous.end) previous.end = Math.max(previous.end, interval.end)
    else merged.push({ ...interval })
  }
  const yOf = (y: number) => y - merged.reduce((sum, interval) => sum + Math.max(0, Math.min(y, interval.end) - interval.start), 0)
  const rectOf = (rect: { x: number; y: number; width: number; height: number }) => ({ ...rect, y: yOf(rect.y), height: Math.max(1, yOf(rect.y + rect.height) - yOf(rect.y)) })
  const key = [...collapsed].sort().join("|")
  const artifacts = Object.fromEntries(Object.entries(frame.presentation.sealedSvgArtifactsByRootId).map(([id, artifact]) => {
    const primitives = svgGraphPrimitivesOf(document, artifact)
    const parsed = new DOMParser().parseFromString(artifact.svg, "image/svg+xml")
    for (const primitive of primitives) {
      const element = parsed.getElementById(primitive.elementId)
      if (!element) continue
      const bounds = primitive.bounds
      const top = yOf(bounds.y)
      const height = yOf(bounds.y + bounds.height) - top
      const scale = ["lifeline", "group-frame", "activation", "message-line"].includes(primitive.role) && bounds.height > 0 ? Math.max(0.001, height / bounds.height) : 1
      const transform = element.getAttribute("transform") ?? ""
      element.setAttribute("transform", `translate(0 ${top}) scale(1 ${scale}) translate(0 ${-bounds.y}) ${transform}`)
    }
    const sourceBounds = rectOf(artifact.sourceBounds)
    parsed.documentElement.setAttribute("viewBox", `${sourceBounds.x} ${sourceBounds.y} ${sourceBounds.width} ${sourceBounds.height}`)
    return [id, { ...artifact, sourceBounds, revisionId: `${artifact.revisionId}:collapse:${key}`, svg: new XMLSerializer().serializeToString(parsed.documentElement) }]
  }))
  const graph = { ...next.graph }
  for (const [id, artifact] of Object.entries(artifacts)) {
    const root = graph[id]
    if (root?.type === "node" && root.layout?.mode === "sealed") graph[id] = { ...root, layout: { ...root.layout, bounds: artifact.sourceBounds } }
  }
  return { ...next, graph, geometry: { ...frame.geometry, revisionId: `${frame.geometry.revisionId}:collapse:${key}`,
    boundsById: Object.fromEntries(Object.entries(frame.geometry.boundsById).map(([id, bounds]) => [id, rectOf(bounds)])),
    headerBoundsById: Object.fromEntries(Object.entries(frame.geometry.headerBoundsById).map(([id, bounds]) => [id, rectOf(bounds)])),
    columnBoundsById: Object.fromEntries(Object.entries(frame.geometry.columnBoundsById ?? {}).map(([id, bounds]) => [id, rectOf(bounds)])),
    endpointAnchorById: Object.fromEntries(Object.entries(frame.geometry.endpointAnchorById).map(([id, point]) => [id, { ...point, y: yOf(point.y) }])),
    routesById: Object.fromEntries(Object.entries(frame.geometry.routesById).map(([id, route]) => [id, new Float32Array([...route].map((v, index) => index % 2 ? yOf(v) : v))])),
  }, presentation: { ...next.presentation, sealedSvgArtifactsByRootId: artifacts } }
}
