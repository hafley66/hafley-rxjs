import { graphHoverColor } from "../../src/lib/0_graphStyle.js"
import { hoverEdgeStops } from "../../src/lib/3_hoverPaint.js"
import type { WheelSettings } from "../../src/lib/1_wheelCamera.js"
import { hoverOpacity } from "../../src/2_graph/16_neighborhood.js"
import { graphStylesheet } from "../../src/lib/1_graphStylesheet.js"
import { GRAPH_STYLES, graphStyleOf, type GraphStyle, type GraphStyleInput } from "../../src/lib/0_graphStyle.js"
import { applySvgStyle } from "../../src/lib/2_svgStyle.js"
import { WheelMomentum } from "../../src/lib/2_wheelMomentum.js"
import { createStickyOverlay, type StickyOptions } from "../../src/lib/0_stickyOverlay.js"
import cytoscape, { type Core, type ElementDefinition } from "cytoscape"
import createDOMPurify from "dompurify"
import { foreignObjectsToText } from "../../src/2_graph/13_foreignObjectText.js"
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
  const fragment = purifier.sanitize(foreignObjectsToText(source), {
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
      const route = primitive.route
      const dx = route[route.length - 2] - route[0]
      const dy = route[route.length - 1] - route[1]
      const length = Math.hypot(dx, dy)
      const segmentWeights: number[] = []
      const segmentDistances: number[] = []
      if (length > 0) for (let at = 2; at < route.length - 2; at += 2) {
        const x = route[at] - route[0]
        const y = route[at + 1] - route[1]
        segmentWeights.push((x * dx + y * dy) / (length * length))
        segmentDistances.push((dx * y - dy * x) / length)
      }
      definitions.push(
        { data: { id: sourceId, graphId: primitive.graphId, kind: "route-endpoint", label: "" }, position: { x: primitive.route[0], y: primitive.route[1] }, classes: "graph-route-endpoint", grabbable: false },
        { data: { id: targetId, graphId: primitive.graphId, kind: "route-endpoint", label: "" }, position: { x: primitive.route[primitive.route.length - 2], y: primitive.route[primitive.route.length - 1] }, classes: "graph-route-endpoint", grabbable: false },
        { data: { id, graphId: primitive.graphId, kind: "edge", source: sourceId, target: targetId, segmentWeights, segmentDistances, direction: graphItem?.type === "edge" ? graphItem.direction : "none", label: labelsById[primitive.graphId]?.text ?? "" }, classes: `graph-native-message${segmentWeights.length ? " graph-native-segments" : ""}` },
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
      grabbable: false,
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
  const sealedRootIds = new Set(Object.keys(frame.presentation.sealedSvgArtifactsByRootId))
  const nativeDescendantIds = new Set<string>()
  for (const id of renderIds) {
    let parentId = frame.graph[id]?.parentId
    while (parentId !== undefined) {
      if (sealedRootIds.has(parentId)) {
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
        ...(sealedRootIds.has(id) ? { classes: "graph-sealed-root", grabbable: false } : {}),
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

function headerViewStyle(c: GraphStyle, left: number, top: number, width: number, height: number): string {
  return `position:absolute;box-sizing:border-box;left:${left}px;top:${top}px;width:${width}px;height:${height}px;pointer-events:none;background:${c.headerBackground};border:1px solid ${c.headerBorder};border-radius:3px;color:${c.headerText};font:600 12px/1.2 system-ui,sans-serif;padding:2px 6px;white-space:nowrap`
}

export type CytoscapeGraphFrameResource = GraphFrameResource & {
  applyWheelSettings: (settings: WheelSettings) => void
  cy: Core
  applySticky: (options: Pick<StickyOptions, "ribbon" | "groups">) => void
  /** Recolor native primitives and headers while retaining the current camera and geometry. */
  applyTheme: (theme: GraphStyleInput) => void
  headerViews: ReadonlyMap<string, HTMLElement>
  sealedSvgViews: ReadonlyMap<string, HTMLElement>
}

export function createCytoscapeGraphFrameResource(
  host?: HTMLElement,
  interactions?: RendererInteractions,
  sticky?: StickyOptions,
): CytoscapeGraphFrameResource {
  const originalBackground = host?.style.background ?? ""
  host?.addEventListener("wheel", onWheel, { capture: true, passive: false })
  const cy = cytoscape({
    container: host,
    headless: host === undefined,
    styleEnabled: true,
    elements: [],
    layout: { name: "preset" },
    style: graphStylesheet(GRAPH_STYLES.light) as any,
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
  const stickyOverlay = host && sticky ? createStickyOverlay(host, sticky, interactions) : undefined
  let theme: GraphStyle = GRAPH_STYLES.light
  let themed = false
  let applyingFrame = false
  let renderedGeometryRevision: string | undefined
  const primitivesByRevision = new Map<string, readonly SvgGraphPrimitive[]>()

  // Canvas viewport changes must move the sealed DOM artifacts in the same event.
  let renderedFrame: GraphFrame | undefined
  cy.on("viewport", () => {
    if (applyingFrame || renderedFrame === undefined) return
    const pan = cy.pan()
    const scale = cy.zoom()
    stickyOverlay?.applyCamera({ x: pan.x, y: pan.y, scale, viewport: { x: 0, y: 0, width: cy.width(), height: cy.height() } })
    for (const [rootId, view] of sealedSvgViews) {
      const artifact = renderedFrame.presentation.sealedSvgArtifactsByRootId[rootId]
      const bounds = renderedFrame.geometry.boundsById[rootId]
      const transform = sealedGeometryTransformOf(artifact.sourceBounds, bounds, artifact.fit)
      view.style.transform = `matrix(${transform.scaleX * scale},0,0,${transform.scaleY * scale},${pan.x + transform.translateX * scale},${pan.y + transform.translateY * scale})`
    }
    for (const [id, view] of headerViews) {
      const bounds = renderedFrame.geometry.headerBoundsById[id]
      view.style.left = `${bounds.x * scale + pan.x}px`
      view.style.width = `${bounds.width * scale}px`
    }
  })

  const momentum = new WheelMomentum()
  let momentumFrame = 0
  const unsubscribeMomentum = (): void => {
    cancelAnimationFrame(momentumFrame)
    momentumFrame = 0
    momentum.unsubscribe()
  }
  const coast = (now: number): void => {
    momentumFrame = 0
    const pan = cy.pan()
    const next = momentum.step({ x: pan.x, y: pan.y, scale: cy.zoom(), viewport: { x: 0, y: 0, width: cy.width(), height: cy.height() } }, now)
    if (next === undefined) return
    cy.viewport({ zoom: next.scale, pan: { x: next.x, y: next.y } })
    momentumFrame = requestAnimationFrame(coast)
  }
  cy.on("mousedown touchstart", unsubscribeMomentum)

  function onWheel(event: WheelEvent): void {
    if (!host || renderedFrame === undefined) return
    event.preventDefault()
    // Capture before Cytoscape's built-in wheel zoom sees this event.
    event.stopImmediatePropagation()
    const rect = host.getBoundingClientRect()
    const pan = cy.pan()
    const next = momentum.push({ x: pan.x, y: pan.y, scale: cy.zoom(), viewport: { x: 0, y: 0, width: cy.width(), height: cy.height() } }, event, { x: event.clientX - rect.left, y: event.clientY - rect.top }, performance.now())
    cy.viewport({ zoom: next.scale, pan: { x: next.x, y: next.y } })
    if (!momentumFrame) momentumFrame = requestAnimationFrame(coast)
  }
  if (interactions) {
    let moving: { id: string; x: number; y: number; dx: number; dy: number } | undefined
    cy.on("mousedown touchstart", "node, edge", event => {
      if (!renderedFrame?.presentation.editable) return
      const id = String(event.target.data("graphId"))
      if (renderedFrame.graph[id]?.type !== "edge" && !["actor-shape", "lifeline"].includes(event.target.data("nativeKind"))) return
      moving = { id, x: event.position.x, y: event.position.y, dx: 0, dy: 0 }
    })
    cy.on("mousemove touchmove", event => {
      if (!moving) return
      moving.dx = event.position.x - moving.x
      moving.dy = event.position.y - moving.y
      interactions.moveInput$?.next({ id: moving.id, dx: moving.dx, dy: moving.dy, phase: "preview" })
    })
    cy.on("mouseup touchend", () => {
      if (!moving) return
      const finished = moving
      moving = undefined
      interactions.moveInput$?.next({ id: finished.id, dx: finished.dx, dy: finished.dy, phase: "commit" })
    })
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

  }

  let currentHops: Readonly<Record<string, number>> = {}
  let committedFocus: ReadonlySet<string> = new Set()
  const applyHover = (hops: Readonly<Record<string, number>>): void => {
    currentHops = hops
    const active = Object.keys(hops).length > 0
    cy.batch(() => {
      for (const element of cy.elements()) {
        const id = String(element.data("graphId") ?? element.id())
        element.toggleClass("graph-focused", committedFocus.has(id) || hops[id] !== undefined)
        element.removeStyle("border-color line-color line-fill line-gradient-stop-colors line-gradient-stop-positions target-arrow-color source-arrow-color color")
        if (element.data("nativeKind") === "lifeline") element.removeStyle("background-color")
        if (hops[id] !== undefined) {
          const color = graphHoverColor(theme, hops[id])
          element.style("color", color)
          element.style(element.group() === "edges" ? { "line-color": color, "target-arrow-color": color, "source-arrow-color": color } : element.data("nativeKind") === "lifeline" ? { "background-color": color } : { "border-color": color })
        }
        if (!element.hasClass("graph-route-endpoint") && !element.hasClass("graph-endpoint-anchor") && !element.hasClass("graph-sealed-root")) element.style("opacity", hoverOpacity(hops[id], active))
        const item = renderedFrame?.graph[id]
        if (active && element.group() === "edges" && item?.type === "edge") {
          const stops = hoverEdgeStops(theme, hops, item.fromId, item.toId)
          const colors = stops.map(stop => {
            element.style("line-color", stop.color)
            const rgb = element.style("line-color")
            return rgb.replace("rgb(", "rgba(").replace(")", `,${stop.opacity})`)
          })
          element.style({ "opacity": 1, "line-color": stops[0].color, "line-fill": "linear-gradient", "line-gradient-stop-colors": colors.join(" "), "line-gradient-stop-positions": "0% 100%", "source-arrow-color": colors[0], "target-arrow-color": colors[1], "text-opacity": hoverOpacity(hops[id], active) })
        } else element.removeStyle("text-opacity")
      }
    })
    stickyOverlay?.applyHover(hops)
  }
  return {
    applyWheelSettings(settings) { unsubscribeMomentum(); momentum.configure(settings) },
    applyHover,
    cy,
    applySticky: options => stickyOverlay?.applySticky(options),
    applyTheme: next => {
      theme = graphStyleOf(next)
      themed = true
      cy.style(graphStylesheet(theme) as any)
      applyHover(currentHops)
      if (host) host.style.background = theme.canvasBackground
      stickyOverlay?.applyTheme(theme)
      for (const view of sealedSvgViews.values()) {
        const svg = view.querySelector("svg")
        if (svg) applySvgStyle(svg, theme)
      }
      if (renderedFrame !== undefined) {
        for (const [id, view] of headerViews) {
          const bounds = renderedFrame.geometry.headerBoundsById[id]
          if (bounds === undefined) continue
          const top = renderedFrame.presentation.stickyHeaders.find(placement => placement.id === id)?.top ?? 0
          view.setAttribute(
            "style",
            headerViewStyle(theme, bounds.x * cy.zoom() + cy.pan().x, top, bounds.width * cy.zoom(), bounds.height * cy.zoom()),
          )
        }
      }
    },
    headerViews,
    sealedSvgViews,
    render(frame, receipt) {
      unsubscribeMomentum()
      renderedFrame = frame
      cy.userPanningEnabled(!frame.presentation.editable)
      const activeRevisions = new Set(Object.values(frame.presentation.sealedSvgArtifactsByRootId).map(artifact => artifact.revisionId))
      for (const revision of primitivesByRevision.keys()) if (!activeRevisions.has(revision)) primitivesByRevision.delete(revision)
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
            current.classes(definition.classes ?? "")
            if (geometryChanged && definition.position && current.isNode()) current.position(definition.position)
          }
          for (const element of cy.elements()) {
            if (!nextById.has(element.id())) element.remove()
            else element.removeClass("graph-hidden graph-focused")
          }
          committedFocus = frame.presentation.focusedIds
          for (const element of cy.elements()) element.toggleClass("graph-hidden", frame.presentation.hiddenIds.has(String(element.data("graphId") ?? element.id())))
          applyHover(frame.presentation.hopsById ?? {})
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
        host.dataset.graphtNativeEdgeCount = String(cy.edges(".graph-native-message").length)
        const movable = cy.$("node[nativeKind = 'actor-shape']").nodes().first()
        if (movable.nonempty()) host.dataset.graphtMovablePosition = JSON.stringify(movable.renderedPosition())
        const movableEdge = cy.edges(".graph-native-message").not(".graph-hidden").first() as cytoscape.EdgeSingular
        if (movableEdge.nonempty()) {
          const point = movableEdge.midpoint(), pan = cy.pan(), scale = cy.zoom()
          if (point) host.dataset.graphtMovableEdgePosition = JSON.stringify({ x: point.x * scale + pan.x, y: point.y * scale + pan.y })
        }
      }

      const scope = graphLayoutScopeOf(frame.graph)
      const outerIds = new Set(scope.itemIds)
      if (stickyOverlay === undefined) {
        const visibleHeaders = new Set(frame.presentation.stickyHeaders.filter(placement => placement.visible && placement.state === "stuck").map(placement => placement.id))
        for (const [id, view] of headerViews) {
          if (visibleHeaders.has(id)) continue
          view.remove()
          headerViews.delete(id)
        }
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
            headerViewStyle(theme, bounds.x * frame.camera.scale + frame.camera.x, placement.top, bounds.width * frame.camera.scale, bounds.height * frame.camera.scale),
          )
        }

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
          if (themed) applySvgStyle(svg, theme)
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
          `position:absolute;left:0;top:0;width:0;height:0;transform-origin:0 0;pointer-events:none;transform:matrix(${transform.scaleX * frame.camera.scale},0,0,${transform.scaleY * frame.camera.scale},${frame.camera.x + transform.translateX * frame.camera.scale},${frame.camera.y + transform.translateY * frame.camera.scale})`,
        )
      }
      stickyOverlay?.render(frame)
    },
    unsubscribe() {
      unsubscribeMomentum()
      host?.removeEventListener("wheel", onWheel, { capture: true })
      if (host) host.style.background = originalBackground
      stickyOverlay?.unsubscribe()
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
