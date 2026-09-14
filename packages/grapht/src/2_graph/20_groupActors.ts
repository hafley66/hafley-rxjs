import type { GraphFrame } from "./0_frame.js"
import { groupGraphItems } from "./17_groupProjection.js"

/** Group existing actor IDs without rewriting source text or message endpoints.
 * Adds a bound header to the sealed SVG so both adapters render the same authored view group.
 * Collapsing the group uses the shared containment visibility projection.
 */
export function groupSequenceActors(frame: GraphFrame, id: string, actors: readonly string[], label: string): GraphFrame {
  if (!actors.length) throw new Error("select at least one actor")
  const columns = actors.map(actor => {
    const bounds = frame.geometry.columnBoundsById?.[actor]
    if (!bounds) throw new Error(`missing actor column: ${actor}`)
    return bounds
  })
  const roots = Object.values(frame.presentation.sealedSvgArtifactsByRootId).filter(artifact => actors.every(actor => artifact.bindings?.some(binding => binding.graphId === actor)))
  if (roots.length !== 1) throw new Error("actors must belong to one bound source diagram")
  const artifact = roots[0]
  const graph = groupGraphItems(frame.graph, id, actors, label, artifact.rootId)
  const x = Math.min(...columns.map(column => column.x))
  const width = Math.max(...columns.map(column => column.x + column.width)) - x
  const bounds = { x, y: artifact.sourceBounds.y - 30, width, height: 24 }
  const parsed = new DOMParser().parseFromString(artifact.svg, "image/svg+xml")
  const namespace = "http://www.w3.org/2000/svg"
  const shape = parsed.createElementNS(namespace, "rect"), text = parsed.createElementNS(namespace, "text")
  const elementId = `grapht-actor-group-${id}`
  shape.setAttribute("id", `${elementId}-shape`)
  shape.setAttribute("class", "loopLine")
  shape.setAttribute("x", String(x)); shape.setAttribute("y", String(bounds.y)); shape.setAttribute("width", String(width)); shape.setAttribute("height", "24")
  shape.setAttribute("fill", "none"); shape.setAttribute("stroke", "#64748b")
  text.setAttribute("id", `${elementId}-label`); text.setAttribute("class", "loopText")
  text.setAttribute("x", String(x + 5)); text.setAttribute("y", String(bounds.y + 17)); text.setAttribute("font-size", "12")
  text.textContent = label
  parsed.documentElement.append(shape, text)
  const sourceBounds = { ...artifact.sourceBounds, y: bounds.y - 4, height: artifact.sourceBounds.height + 34 }
  parsed.documentElement.setAttribute("viewBox", `${sourceBounds.x} ${sourceBounds.y} ${sourceBounds.width} ${sourceBounds.height}`)
  const revisionId = `${artifact.revisionId}:actor-group:${id}`
  const root = graph[artifact.rootId]
  return { ...frame, graph: { ...graph, [artifact.rootId]: { ...root, type: "node", layout: { mode: "sealed", bounds: sourceBounds, geometryRevisionId: revisionId } } },
    geometry: { ...frame.geometry, revisionId,
      boundsById: { ...frame.geometry.boundsById, [artifact.rootId]: sourceBounds, [id]: bounds },
      headerBoundsById: { ...frame.geometry.headerBoundsById, [id]: bounds },
    }, presentation: { ...frame.presentation, labelsById: { ...frame.presentation.labelsById, [id]: { text: label } },
      sealedSvgArtifactsByRootId: { ...frame.presentation.sealedSvgArtifactsByRootId, [artifact.rootId]: { ...artifact, sourceBounds, revisionId, geometryRevisionId: revisionId, svg: new XMLSerializer().serializeToString(parsed.documentElement), bindings: [...artifact.bindings ?? [],
        { elementId: `${elementId}-shape`, graphId: id, role: "group-frame", ordinal: 0 },
        { elementId: `${elementId}-label`, graphId: id, role: "group-label", ordinal: 0 },
      ] } },
    } }
}
