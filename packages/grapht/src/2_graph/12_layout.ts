import cytoscape, { type ElementDefinition } from "cytoscape"
import fcose from "cytoscape-fcose"
import { graphLayoutScopeOf, type Graph, type GraphId, type GraphLayoutScope, validateGraph } from "@hafley66/grapht-model"
import type { GraphGeometry } from "./0_frame.js"
import type { Rect } from "../1_sequence/3_geometry.js"

const HEADER_HEIGHT = 24

// Deferred to first layout, else import registers a Cytoscape extension as a
// load side effect and UMD interop hands it a namespace instead of the factory.
let fcoseRegistered = false
function ensureFcose(): void {
  if (fcoseRegistered) return
  cytoscape.use(fcose)
  fcoseRegistered = true
}

function hash(text: string): string {
  let value = 0x811c9dc5
  for (let index = 0; index < text.length; index++) {
    value ^= text.charCodeAt(index)
    value = Math.imul(value, 0x01000193)
  }
  return (value >>> 0).toString(16).padStart(8, "0")
}

function revisionIdOf(graph: Graph, scope: GraphLayoutScope): string {
  const input = scope.itemIds
    .map(id => {
      const item = graph[id]
      if (item.type === "edge") {
        return [
          id,
          item.type,
          item.parentId ?? "",
          scope.endpointIdByGraphId[item.fromId] ?? "",
          scope.endpointIdByGraphId[item.toId] ?? "",
          item.direction,
        ].join("\u0000")
      }
      if (item.layout?.mode !== "sealed") return [id, item.type, item.parentId ?? ""].join("\u0000")
      const ports = Object.entries(item.layout.ports ?? {})
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([portId, point]) => [portId, point.x, point.y].join("\u0000"))
        .join("\u0001")
      return [
        id,
        item.type,
        item.parentId ?? "",
        item.layout.mode,
        item.layout.bounds.x,
        item.layout.bounds.y,
        item.layout.bounds.width,
        item.layout.bounds.height,
        item.layout.geometryRevisionId,
        ports,
      ].join("\u0000")
    })
    .join("\u0001")
  return `cytoscape-fcose:${hash(input)}`
}

function rectOf(element: { boundingBox(options: { includeLabels: boolean; includeOverlays: boolean }): { x1: number; y1: number; w: number; h: number } }): Rect {
  const bounds = element.boundingBox({ includeLabels: false, includeOverlays: false })
  return { x: bounds.x1, y: bounds.y1, width: bounds.w, height: bounds.h }
}

function anchorOf(bounds: Rect): { x: number; y: number } {
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
}

function layoutElementsOf(graph: Graph, ids: readonly GraphId[], scope: GraphLayoutScope): ElementDefinition[] {
  const cyIdByGraphId = new Map(ids.map((id, index) => [id, `n${index}`]))
  const elements: ElementDefinition[] = ids.map((id, index) => {
    const item = graph[id]
    const parent = item.parentId === undefined ? undefined : cyIdByGraphId.get(item.parentId)
    const sealedBounds = item.type === "node" && item.layout?.mode === "sealed" ? item.layout.bounds : undefined
    return {
      data: {
        id: cyIdByGraphId.get(id),
        graphId: id,
        ...(parent === undefined ? {} : { parent }),
        ...(sealedBounds === undefined ? {} : { layoutWidth: Math.max(1, sealedBounds.width - 2), layoutHeight: Math.max(1, sealedBounds.height - 2) }),
      },
      position: { x: (index % 7) * 160, y: Math.floor(index / 7) * 130 },
    }
  })

  for (const [index, id] of ids.entries()) {
    const edge = graph[id]
    if (edge.type !== "edge") continue
    const edgeNode = cyIdByGraphId.get(id)
    const fromId = scope.endpointIdByGraphId[edge.fromId]
    const toId = scope.endpointIdByGraphId[edge.toId]
    if (fromId === undefined || toId === undefined) continue
    const from = cyIdByGraphId.get(fromId)
    const to = cyIdByGraphId.get(toId)
    if (edgeNode === undefined || from === undefined || to === undefined) continue
    elements.push({ data: { id: `e${index}:from`, source: from, target: edgeNode } })
    elements.push({ data: { id: `e${index}:to`, source: edgeNode, target: to } })
  }

  return elements
}

/**
 * Projects every Graph item to an fCoSE node. Logical edges become two layout
 * edges through their proxy node because Cytoscape edges cannot target edges.
 * The proxy position is the edge endpoint anchor and the middle route point.
 */
export function fcoseGraphLayout<NodeData, EdgeData>(graph: Graph<NodeData, EdgeData>, signal: AbortSignal): GraphGeometry {
  if (signal.aborted) throw signal.reason ?? new Error("Graph layout aborted")

  const diagnostics = validateGraph(graph)
  if (diagnostics.length > 0) throw new Error(diagnostics.map(diagnostic => diagnostic.message).join("\n"))

  const scope = graphLayoutScopeOf(graph)
  const ids = scope.itemIds
  const cyIdByGraphId = new Map(ids.map((id, index) => [id, `n${index}`]))
  const groupNodeIds = new Set(ids.flatMap(id => graph[id].parentId === undefined ? [] : [graph[id].parentId]))
  ensureFcose()
  const cy = cytoscape({
    headless: true,
    styleEnabled: true,
    style: [
      { selector: "node", style: { width: "48px", height: "32px" } },
      { selector: "node[layoutWidth]", style: { width: "data(layoutWidth)", height: "data(layoutHeight)" } },
      { selector: "node:parent", style: { padding: "24px" } },
    ],
    elements: layoutElementsOf(graph, ids, scope),
  })

  try {
    cy.layout({
      name: "fcose",
      quality: "proof",
      randomize: false,
      animate: false,
      fit: false,
      packComponents: false,
      tile: false,
      idealEdgeLength: 80,
      nodeSeparation: 40,
      numIter: 2500,
    } as never).run()
    if (signal.aborted) throw signal.reason ?? new Error("Graph layout aborted")

    const boundsById: Record<GraphId, Rect> = {}
    const endpointAnchorById: Record<GraphId, { x: number; y: number }> = {}
    const headerBoundsById: Record<GraphId, Rect> = {}

    for (const id of ids) {
      const item = graph[id]
      const cyId = cyIdByGraphId.get(id)
      if (cyId === undefined) continue
      const bounds = rectOf(cy.getElementById(cyId))
      endpointAnchorById[id] = anchorOf(bounds)
      if (item.type !== "node") continue
      boundsById[id] = bounds
      if (!groupNodeIds.has(id)) continue
      headerBoundsById[id] = { x: bounds.x, y: bounds.y, width: bounds.width, height: Math.min(HEADER_HEIGHT, bounds.height) }
    }

    const routesById: Record<GraphId, Float32Array> = {}
    for (const id of ids) {
      const edge = graph[id]
      if (edge.type !== "edge") continue
      const from = endpointAnchorById[scope.endpointIdByGraphId[edge.fromId] ?? ""]
      const edgeAnchor = endpointAnchorById[id]
      const to = endpointAnchorById[scope.endpointIdByGraphId[edge.toId] ?? ""]
      if (from === undefined || edgeAnchor === undefined || to === undefined) continue
      routesById[id] = new Float32Array([from.x, from.y, edgeAnchor.x, edgeAnchor.y, to.x, to.y])
    }

    return {
      revisionId: revisionIdOf(graph, scope),
      boundsById,
      endpointAnchorById,
      routesById,
      headerBoundsById,
    }
  } finally {
    cy.destroy()
  }
}
