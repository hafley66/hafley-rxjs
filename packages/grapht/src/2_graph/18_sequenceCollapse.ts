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
  const hidden = new Set(next.presentation.hiddenIds)
  const suppressed = new Set(Object.keys(frame.geometry.columnBoundsById ?? {}).filter(id => hidden.has(id) || collapsed.has(id)))
  const children = new Map<string, string[]>()
  for (const item of Object.values(frame.graph)) {
    if (item.parentId) {
      const siblings = children.get(item.parentId) ?? []
      siblings.push(item.id); children.set(item.parentId, siblings)
    }
    // A directly collapsed actor retains its header but suppresses its messages too.
    if (item.type === "edge" && (suppressed.has(item.fromId) || suppressed.has(item.toId))) { hidden.add(item.id); suppressed.add(item.id) }
  }
  const emptyGroups = new Set<string>()
  let changed = true
  while (changed) {
    changed = false
    for (const id of Object.keys(frame.geometry.headerBoundsById)) {
      const members = children.get(id) ?? []
      const actorSuppressed = members.length > 0 && members.every(member => suppressed.has(member)) && !members.some(member => frame.geometry.columnBoundsById?.[member])
      if (actorSuppressed && !suppressed.has(id)) { suppressed.add(id); changed = true }
      if (hidden.has(id)) continue
      if (actorSuppressed || !collapsed.has(id) && members.length && members.every(member => hidden.has(member))) {
        hidden.add(id); emptyGroups.add(id); changed = true
      }
    }
  }
  next.presentation = { ...next.presentation, hiddenIds: hidden }
  const visibleContent = Object.values(frame.graph).filter(item => !hidden.has(item.id) &&
    (item.type === "edge" || ["note", "activation"].includes((item.data as { kind?: string } | undefined)?.kind ?? "")))
  // Empty containers release their entire interval; explicitly collapsed groups retain a header.
  const intervals = [...collapsed, ...emptyGroups].filter(id => emptyGroups.has(id) || !hidden.has(id))
    .flatMap(id => {
      const bounds = frame.geometry.boundsById[id]
      const retained = emptyGroups.has(id) ? 0 : 30
      // A parallel sibling may still occupy these rows even when this container is empty.
      if (bounds && emptyGroups.has(id) && visibleContent.some(item => {
        const content = frame.geometry.boundsById[item.id]
        return content && content.y < bounds.y + bounds.height && content.y + content.height > bounds.y
      })) return []
      return bounds && bounds.height > retained ? [{ start: bounds.y + retained, end: bounds.y + bounds.height }] : []
    }).sort((a, b) => a.start - b.start)
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
