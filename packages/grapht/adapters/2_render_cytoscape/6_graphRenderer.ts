import cytoscape, { type Core, type ElementDefinition } from "cytoscape"
import createDOMPurify from "dompurify"
import { graphLayoutScopeOf, type GraphLayoutScope } from "@hafley66/grapht-model"
import {
  graphRenderer,
  sealedGeometryTransformOf,
  svgGraphPrimitivesOf,
  type GraphFrame,
  type GraphFrameResource,
  type GraphRenderer,
  type RendererInteractions,
  type SvgGraphPrimitive,
} from "@hafley66/grapht/browser"

const anchorId = (id: string): string => `${id}::endpoint-anchor`

function endpointId(frame: GraphFrame, scope: GraphLayoutScope, renderIds: ReadonlySet<string>, id: string): string | undefined {
  if (renderIds.has(id)) return frame.graph[id]?.type === "edge" ? anchorId(id) : id
  const layoutId = scope.endpointIdByGraphId[id]
  if (layoutId === undefined) return undefined
  return frame.graph[layoutId]?.type === "edge" ? anchorId(layoutId) : layoutId
}

function point(frame: GraphFrame, id: string): { x: number; y: number } {
  return frame.geometry.endpointAnchorById[id] ?? { x: 0, y: 0 }
}

function position(frame: GraphFrame, id: string): { x: number; y: number } {
  const bounds = frame.geometry.boundsById[id]
  return bounds ? { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 } : point(frame, id)
}

function groupNodeIds(frame: GraphFrame, layoutIds: ReadonlySet<string>): ReadonlySet<string> {
  return new Set(
    Object.values(frame.graph).flatMap(item =>
      item.parentId !== undefined && layoutIds.has(item.parentId) && frame.graph[item.parentId]?.type === "node" ? [item.parentId] : [],
    ),
  )
}

function sanitizedSvg(document: Document, source: string): SVGSVGElement {
  const window = document.defaultView
  if (window === null) throw new Error("sealed SVG rendering requires a document window")
  const purifier = createDOMPurify(window)
  const fragment = purifier.sanitize(source, {
    USE_PROFILES: { svg: true, svgFilters: true },
    RETURN_DOM_FRAGMENT: true,
    FORBID_TAGS: ["foreignObject", "script"],
  })
  const svg = fragment.querySelector("svg")
  if (!(svg instanceof window.SVGSVGElement)) throw new Error("sealed SVG artifact does not contain an svg root")
  return svg
}

type BoundPrimitive = SvgGraphPrimitive & { rootId: string }

const primitiveId = (primitive: BoundPrimitive): string => `svg::${primitive.rootId}::${primitive.elementId}`
const routeEndpointId = (primitive: BoundPrimitive, endpoint: "source" | "target"): string => `${primitiveId(primitive)}::${endpoint}`

function transformedPrimitive(frame: GraphFrame, primitive: BoundPrimitive): SvgGraphPrimitive | undefined {
  const artifact = frame.presentation.sealedSvgArtifactsByRootId[primitive.rootId]
  const rootBounds = frame.geometry.boundsById[primitive.rootId]
  if (artifact === undefined || rootBounds === undefined) return undefined
  const transform = sealedGeometryTransformOf(artifact.sourceBounds, rootBounds, artifact.fit)
  const bounds = {
    x: primitive.bounds.x * transform.scaleX + transform.translateX,
    y: primitive.bounds.y * transform.scaleY + transform.translateY,
    width: primitive.bounds.width * transform.scaleX,
    height: primitive.bounds.height * transform.scaleY,
  }
  const delta = frame.presentation.translationsById?.[primitive.graphId]
  if (delta !== undefined) {
    bounds.x += delta.x
    bounds.y += delta.y
  }
  const sourceRoute = primitive.role === "message-line" ? frame.geometry.routesById[primitive.graphId] ?? primitive.route : primitive.route
  const route = sourceRoute === undefined ? undefined : primitive.role === "message-line" && frame.geometry.routesById[primitive.graphId] !== undefined
    ? sourceRoute
    : new Float32Array(
    [...sourceRoute].map((value, index) => value * (index % 2 === 0 ? transform.scaleX : transform.scaleY) + (index % 2 === 0 ? transform.translateX : transform.translateY)),
  )
  return { ...primitive, bounds, route }
}

function primitiveDefinitions(frame: GraphFrame, sourcePrimitives: readonly BoundPrimitive[]): ElementDefinition[] {
  const definitions: ElementDefinition[] = []
  const labelsById = frame.presentation.labelsById
  for (const sourcePrimitive of sourcePrimitives) {
    const primitive = transformedPrimitive(frame, sourcePrimitive)
    if (primitive === undefined) continue
    const id = primitiveId(sourcePrimitive)
    if (primitive.role === "message-line" && primitive.route !== undefined && primitive.route.length >= 4) {
      const sourceId = routeEndpointId(sourcePrimitive, "source")
      const targetId = routeEndpointId(sourcePrimitive, "target")
      const graphItem = frame.graph[primitive.graphId]
      definitions.push(
        { data: { id: sourceId, graphId: primitive.graphId, kind: "route-endpoint", label: "" }, position: { x: primitive.route[0], y: primitive.route[1] }, classes: "graph-route-endpoint" },
        { data: { id: targetId, graphId: primitive.graphId, kind: "route-endpoint", label: "" }, position: { x: primitive.route[primitive.route.length - 2], y: primitive.route[primitive.route.length - 1] }, classes: "graph-route-endpoint" },
        { data: { id, graphId: primitive.graphId, kind: "edge", source: sourceId, target: targetId, direction: graphItem?.type === "edge" ? graphItem.direction : "none", label: labelsById[primitive.graphId]?.text ?? "" }, classes: "graph-native-message" },
      )
      continue
    }
    if (!["actor-shape", "lifeline", "group-frame", "group-label", "activation", "note-shape"].includes(primitive.role)) continue
    const label = ["actor-shape", "group-label", "note-shape"].includes(primitive.role)
      ? labelsById[primitive.graphId]?.text ?? ""
      : ""
    definitions.push({
      data: { id, graphId: primitive.graphId, kind: "svg-primitive", nativeKind: primitive.role, width: Math.max(1, primitive.bounds.width), height: Math.max(1, primitive.bounds.height), label },
      position: { x: primitive.bounds.x + primitive.bounds.width / 2, y: primitive.bounds.y + primitive.bounds.height / 2 },
      classes: `graph-svg-primitive graph-${primitive.role}`,
    })
  }
  return definitions
}

function definitions(frame: GraphFrame, sourcePrimitives: readonly BoundPrimitive[]): ElementDefinition[] {
  const nodes: ElementDefinition[] = []
  const edges: ElementDefinition[] = []
  const labelsById = frame.presentation.labelsById
  const headerIds = new Set(Object.keys(frame.geometry.headerBoundsById))
  const scope = graphLayoutScopeOf(frame.graph)
  const layoutIds = new Set(scope.itemIds)
  const renderIds = new Set([
    ...layoutIds,
    ...Object.keys(frame.geometry.boundsById),
    ...Object.keys(frame.geometry.endpointAnchorById),
    ...Object.keys(frame.geometry.routesById),
  ])
  const nativeRootIds = new Set(Object.values(frame.presentation.sealedSvgArtifactsByRootId).filter(artifact => (artifact.bindings?.length ?? 0) > 0).map(artifact => artifact.rootId))
  for (const rootId of nativeRootIds) renderIds.delete(rootId)
  const nativeDescendantIds = new Set<string>()
  for (const id of renderIds) {
    let parentId = frame.graph[id]?.parentId
    while (parentId !== undefined) {
      if (nativeRootIds.has(parentId)) {
        nativeDescendantIds.add(id)
        break
      }
      parentId = frame.graph[parentId]?.parentId
    }
  }
  const groups = groupNodeIds(frame, renderIds)
  for (const id of Object.keys(frame.graph).sort()) {
    if (!renderIds.has(id)) continue
    const item = frame.graph[id]
    if (nativeDescendantIds.has(id)) continue
    if (item.type === "node") {
      const bounds = frame.geometry.boundsById[id]
      const isGroup = groups.has(id)
      const nativeKind = typeof item.data === "object" && item.data !== null && "kind" in item.data ? String(item.data.kind) : ""
      const nativeDescendant = nativeDescendantIds.has(id)
      nodes.push({
        data: {
          id,
          graphId: id,
          kind: "node",
          nativeKind,
          ...(isGroup && !nativeDescendant || bounds === undefined ? {} : { width: bounds.width, height: bounds.height }),
          // The sticky overlay owns group labels, so native compound labels stay empty.
          label: headerIds.has(id) ? "" : labelsById[id]?.text ?? "",
          parent: item.parentId && !nativeDescendant ? endpointId(frame, scope, renderIds, item.parentId) : undefined,
        },
        ...(isGroup && !nativeDescendant ? {} : { position: position(frame, id) }),
      })
      continue
    }
    const from = endpointId(frame, scope, renderIds, item.fromId)
    const to = endpointId(frame, scope, renderIds, item.toId)
    if (from === undefined || to === undefined) continue
    const bounds = frame.geometry.boundsById[id]
    nodes.push({
      data: {
        id: anchorId(id),
        graphId: id,
        kind: "edge-anchor",
        width: bounds?.width ?? 1,
        height: bounds?.height ?? 1,
        label: "",
        parent: item.parentId && !nativeDescendantIds.has(id) ? endpointId(frame, scope, renderIds, item.parentId) : undefined,
      },
      position: position(frame, id),
      classes: "graph-endpoint-anchor",
    })
    edges.push({
      data: {
        id,
        graphId: id,
        kind: "edge",
        source: from,
        target: to,
        direction: item.direction,
        label: headerIds.has(id) ? "" : labelsById[id]?.text ?? "",
      },
    })
  }
  return [...nodes, ...edges, ...primitiveDefinitions(frame, sourcePrimitives)]
}

export type CytoscapeGraphFrameResource = GraphFrameResource & {
  cy: Core
  headerViews: ReadonlyMap<string, HTMLElement>
  sealedSvgViews: ReadonlyMap<string, HTMLElement>
}

export function createCytoscapeGraphFrameResource(
  host?: HTMLElement,
  interactions?: RendererInteractions,
): CytoscapeGraphFrameResource {
  const cy = cytoscape({
    container: host,
    headless: host === undefined,
    styleEnabled: true,
    elements: [],
    layout: { name: "preset" },
    style: [
      { selector: "node", style: { label: "data(label)", backgroundColor: "#1e293b", borderColor: "#93c5fd", borderWidth: 1, color: "#f8fafc", fontSize: 12, textOutlineColor: "#10141c", textOutlineWidth: 2 } },
      { selector: "node[width][height]", style: { width: "data(width)", height: "data(height)" } },
      { selector: "node[nativeKind = 'actor-shape']", style: { shape: "roundrectangle", backgroundColor: "#dbeafe", borderColor: "#3b82f6", color: "#111827", textOutlineWidth: 0, textHalign: "center", textValign: "center" } },
      { selector: "node[nativeKind = 'lifeline']", style: { shape: "rectangle", backgroundColor: "#64748b", borderWidth: 0 } },
      { selector: "node[nativeKind = 'group-frame']", style: { shape: "rectangle", backgroundOpacity: 0.04, borderColor: "#64748b" } },
      { selector: "node[nativeKind = 'group-label']", style: { shape: "rectangle", backgroundOpacity: 0, borderWidth: 0, textHalign: "center", textValign: "center" } },
      { selector: "node[nativeKind = 'activation']", style: { shape: "rectangle", backgroundColor: "#c4b5fd", borderColor: "#8b5cf6" } },
      { selector: "node[nativeKind = 'note-shape']", style: { shape: "rectangle", backgroundColor: "#fef3c7", borderColor: "#d97706", color: "#111827", textOutlineWidth: 0, textHalign: "center", textValign: "center" } },
      { selector: "node:parent", style: { backgroundColor: "#172554", backgroundOpacity: 0.38, borderColor: "#64748b", borderWidth: 1, padding: 24 } },
      { selector: "edge", style: { label: "data(label)", curveStyle: "bezier", lineColor: "#94a3b8", targetArrowColor: "#94a3b8", sourceArrowColor: "#94a3b8", color: "#f8fafc", fontSize: 12, textBackgroundColor: "#10141c", textBackgroundOpacity: 0.86, textBackgroundPadding: 2 } },
      { selector: ".graph-endpoint-anchor", style: { width: "data(width)", height: "data(height)", opacity: 0 } },
      { selector: ".graph-route-endpoint", style: { width: 1, height: 1, opacity: 0 } },
      { selector: ".graph-native-message", style: { curveStyle: "straight" } },
      { selector: "edge[direction = 'forward']", style: { targetArrowShape: "triangle" } },
      { selector: "edge[direction = 'both']", style: { sourceArrowShape: "triangle", targetArrowShape: "triangle" } },
      { selector: "node.graph-focused", style: { borderColor: "#fbbf24", borderWidth: 3, backgroundColor: "#334155" } },
      { selector: "edge.graph-focused", style: { lineColor: "#fbbf24", targetArrowColor: "#fbbf24", sourceArrowColor: "#fbbf24", width: 3 } },
      { selector: ".graph-hidden", style: { display: "none" } },
    ] as any,
  })
  const headerLayer = host?.ownerDocument.createElement("div")
  const headerViews = new Map<string, HTMLElement>()
  const sealedSvgLayer = host?.ownerDocument.createElement("div")
  const sealedSvgViews = new Map<string, HTMLElement>()
  if (headerLayer && host) {
    headerLayer.dataset.graphtOverlay = "sticky-headers"
    headerLayer.setAttribute("style", "position:absolute;inset:0;overflow:hidden;pointer-events:none")
    host.appendChild(headerLayer)
  }
  if (sealedSvgLayer && host) {
    sealedSvgLayer.dataset.graphtOverlay = "sealed-svg"
    sealedSvgLayer.setAttribute("style", "position:absolute;inset:0;overflow:hidden;pointer-events:none")
    host.appendChild(sealedSvgLayer)
  }
  let applyingFrame = false
  let renderedGeometryRevision: string | undefined
  const primitivesByRevision = new Map<string, readonly SvgGraphPrimitive[]>()

  if (interactions) {
    const dragPositionByElementId = new Map<string, { x: number; y: number }>()
    cy.on("viewport", () => {
      if (applyingFrame) return
      const pan = cy.pan()
      interactions.cameraInput$.next({
        x: pan.x,
        y: pan.y,
        scale: cy.zoom(),
        viewport: { x: 0, y: 0, width: cy.width(), height: cy.height() },
      })
    })
    cy.on("mouseover", "node, edge", event => interactions.focusInput$.next(new Set([String(event.target.data("graphId"))])))
    cy.on("mouseout", "node, edge", () => interactions.focusInput$.next(new Set()))
    cy.on("select unselect", "node, edge", () => {
      interactions.selectionInput$.next(new Set(cy.$(":selected").map(element => String(element.data("graphId")))))
    })
    cy.on("grab", "node[nativeKind = 'actor-shape']", event => {
      dragPositionByElementId.set(event.target.id(), event.target.position())
    })
    cy.on("drag", "node[nativeKind = 'actor-shape']", event => {
      const previous = dragPositionByElementId.get(event.target.id())
      const current = event.target.position()
      dragPositionByElementId.set(event.target.id(), current)
      if (previous === undefined) return
      interactions.moveInput$?.next({ id: String(event.target.data("graphId")), dx: current.x - previous.x, dy: current.y - previous.y })
    })
    cy.on("free", "node[nativeKind = 'actor-shape']", event => dragPositionByElementId.delete(event.target.id()))
  }

  return {
    cy,
    headerViews,
    sealedSvgViews,
    render(frame, receipt) {
      const sourcePrimitives = Object.values(frame.presentation.sealedSvgArtifactsByRootId).flatMap(artifact => {
        const cached = primitivesByRevision.get(artifact.revisionId)
        if (cached !== undefined) return cached.map(primitive => ({ ...primitive, rootId: artifact.rootId }))
        if (host === undefined) return []
        const measured = svgGraphPrimitivesOf(host.ownerDocument, artifact)
        primitivesByRevision.set(artifact.revisionId, measured)
        return measured.map(primitive => ({ ...primitive, rootId: artifact.rootId }))
      })
      const next = definitions(frame, sourcePrimitives)
      const nextById = new Map(next.map(definition => [String(definition.data?.id), definition]))
      const geometryChanged = renderedGeometryRevision !== frame.geometry.revisionId
      applyingFrame = true
      try {
        cy.batch(() => {
          for (const id of receipt.exitIds) {
            cy.$id(id).remove()
            cy.$id(anchorId(id)).remove()
          }
          for (const definition of next) {
            const id = String(definition.data?.id)
            const current = cy.$id(id)
            if (current.empty()) {
              cy.add(definition)
              continue
            }
            current.data(definition.data ?? {})
            if (geometryChanged && definition.position && current.isNode()) current.position(definition.position)
          }
          for (const element of cy.elements()) {
            if (!nextById.has(element.id())) element.remove()
            else element.removeClass("graph-hidden graph-focused")
          }
          for (const id of frame.presentation.hiddenIds) cy.$id(id).addClass("graph-hidden")
          for (const id of frame.presentation.focusedIds) {
            cy.$id(id).addClass("graph-focused")
            cy.$id(anchorId(id)).addClass("graph-focused")
          }
          cy.pan({ x: frame.camera.x, y: frame.camera.y })
          cy.zoom(frame.camera.scale)
        })
      } finally {
        applyingFrame = false
      }
      renderedGeometryRevision = frame.geometry.revisionId
      if (host) {
        host.dataset.graphtRenderer = "cytoscape"
        host.dataset.graphtItemCount = String(cy.elements().length)
        const movable = cy.$("node[nativeKind = 'actor-shape']").nodes().first()
        if (movable.nonempty()) host.dataset.graphtMovablePosition = JSON.stringify(movable.renderedPosition())
      }

      const visibleHeaders = new Set(frame.presentation.stickyHeaders.filter(placement => placement.visible && placement.state === "stuck").map(placement => placement.id))
      for (const [id, view] of headerViews) {
        if (visibleHeaders.has(id)) continue
        view.remove()
        headerViews.delete(id)
      }
      const scope = graphLayoutScopeOf(frame.graph)
      const outerIds = new Set(scope.itemIds)
      for (const placement of frame.presentation.stickyHeaders) {
        if (!placement.visible || placement.state !== "stuck" || !headerLayer) continue
        const bounds = frame.geometry.headerBoundsById[placement.id]
        if (!bounds) continue
        const view = headerViews.get(placement.id) ?? headerLayer.ownerDocument.createElement("div")
        if (!headerViews.has(placement.id)) {
          view.dataset.graphId = placement.id
          headerViews.set(placement.id, view)
          headerLayer.appendChild(view)
        }
        view.textContent = frame.presentation.labelsById[placement.id]?.text ?? ""
        view.setAttribute(
          "style",
          `position:absolute;box-sizing:border-box;left:${bounds.x * frame.camera.scale + frame.camera.x}px;top:${placement.top}px;width:${bounds.width * frame.camera.scale}px;height:${bounds.height * frame.camera.scale}px;pointer-events:none;background:#172554;border:1px solid #93c5fd;border-radius:3px;color:#f8fafc;font:600 12px/1.2 system-ui,sans-serif;padding:2px 6px;white-space:nowrap`,
        )
      }

      const artifacts = frame.presentation.sealedSvgArtifactsByRootId
      const activeSealedRootIds = new Set(
        Object.keys(artifacts).filter(rootId => (artifacts[rootId].bindings?.length ?? 0) === 0 && outerIds.has(rootId) && frame.geometry.boundsById[rootId] !== undefined),
      )
      for (const [rootId, view] of sealedSvgViews) {
        if (activeSealedRootIds.has(rootId)) continue
        view.remove()
        sealedSvgViews.delete(rootId)
      }
      for (const rootId of [...activeSealedRootIds].sort()) {
        if (!sealedSvgLayer) continue
        const artifact = artifacts[rootId]
        const bounds = frame.geometry.boundsById[rootId]
        if (artifact === undefined || bounds === undefined) continue
        let view = sealedSvgViews.get(rootId)
        if (view?.dataset.revisionId !== artifact.revisionId) {
          view?.remove()
          view = sealedSvgLayer.ownerDocument.createElement("div")
          view.dataset.graphId = rootId
          view.dataset.revisionId = artifact.revisionId
          const svg = sanitizedSvg(sealedSvgLayer.ownerDocument, artifact.svg)
          view.appendChild(svg)
          svg.style.position = "absolute"
          svg.style.left = `${artifact.sourceBounds.x}px`
          svg.style.top = `${artifact.sourceBounds.y}px`
          svg.style.width = `${artifact.sourceBounds.width}px`
          svg.style.height = `${artifact.sourceBounds.height}px`
          sealedSvgViews.set(rootId, view)
          sealedSvgLayer.appendChild(view)
        }
        const transform = sealedGeometryTransformOf(artifact.sourceBounds, bounds, artifact.fit)
        view.setAttribute(
          "style",
          `position:absolute;left:0;top:0;width:0;height:0;transform-origin:0 0;pointer-events:auto;transform:matrix(${transform.scaleX * frame.camera.scale},0,0,${transform.scaleY * frame.camera.scale},${frame.camera.x + transform.translateX * frame.camera.scale},${frame.camera.y + transform.translateY * frame.camera.scale})`,
        )
      }
    },
    unsubscribe() {
      headerLayer?.remove()
      headerViews.clear()
      sealedSvgLayer?.remove()
      sealedSvgViews.clear()
      primitivesByRevision.clear()
      cy.destroy()
    },
  }
}

export function cytoscapeGraphRenderer(interactions?: RendererInteractions): GraphRenderer {
  return graphRenderer(host => createCytoscapeGraphFrameResource(host, interactions))
}
