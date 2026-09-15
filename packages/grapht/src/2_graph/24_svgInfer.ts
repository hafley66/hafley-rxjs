import { documentFingerprint, type GraphId, type GraphItem } from "@hafley66/grapht-model"
import type { Rect } from "../1_sequence/3_geometry.js"
import type { GraphFrame, GraphGeometry } from "./0_frame.js"
import { fitGraphCamera } from "./1_fitCamera.js"
import { validateSealedSvgArtifacts, type SealedSvgArtifact } from "./3_sealedSvgArtifact.js"
import { withSvgNamespace } from "./4_svgGeometry.js"

/** One step of the parse scan, in the order the inferrer took it. */
export type SvgInferStep =
  | { kind: "classify"; elementId: string; role: "area" | "connector"; why: string }
  | { kind: "label"; graphId: GraphId; text: string }
  | { kind: "anchor"; graphId: GraphId; end: "start" | "end"; distance: number; hit?: GraphId; via?: GraphId }
  | { kind: "edge"; graphId: GraphId; fromId: GraphId; toId: GraphId; direction: "none" | "forward" | "both" }
  | { kind: "lost"; graphId: GraphId; reason: "start-unanchored" | "end-unanchored" }

export type SvgInferNodeData = { kind: "area"; label?: string }
export type SvgInferEdgeData = { kind: "connector"; label?: string; dashed?: boolean }

export type SvgInferOptions = {
  /** Rendered connectors stop short of the border; containment needs this much slack. */
  anchorSlack?: number
  /** How many connectors an endpoint may follow before giving up. */
  chainDepth?: number
  /** How close free text sits to a connector to count as its label. */
  labelReach?: number
  /** Distance between samples along a connector; contacts between samples are invisible. */
  sampleSpacing?: number
}

export type SvgInferResult = {
  frame: GraphFrame<SvgInferNodeData, SvgInferEdgeData>
  steps: readonly SvgInferStep[]
  counts: { primitives: number; areas: number; connectors: number; edges: number; lost: number }
}

export type SvgInferInput = {
  svg: string
  locator: string
  rootId?: string
  viewport: { width: number; height: number }
  options?: SvgInferOptions
  onStep?: (step: SvgInferStep) => void
}

const HIDDEN_ANCESTORS: Record<string, true> = { defs: true, marker: true, mask: true, clippath: true, pattern: true, symbol: true, style: true, title: true, desc: true }
const CLOSED_TAGS: Record<string, true> = { rect: true, circle: true, ellipse: true, polygon: true }

function sourceBoundsOf(parsed: Document, svg: Element): Rect {
  const viewBox = svg.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number)
  const dimension = (name: string) => {
    const value = svg.getAttribute(name) ?? ""
    return /^\d+(?:\.\d+)?(?:px)?$/.test(value) ? parseFloat(value) : NaN
  }
  const values = viewBox ?? [0, 0, dimension("width"), dimension("height")]
  if (values.length !== 4 || !values.every(Number.isFinite) || values[2] <= 0 || values[3] <= 0) {
    throw new Error(`SVG requires a finite viewBox or positive pixel width/height: ${parsed.documentElement.localName}`)
  }
  return { x: values[0], y: values[1], width: values[2], height: values[3] }
}

/**
 * Recovers a flat graph from any rendered SVG without knowing which tool drew it:
 * closed primitives are areas, open ones connectors, endpoints anchor by containment with slack,
 * an endpoint that lands on another connector continues through it, direction comes from markers.
 * The measured frame renders through the normal renderers; `steps` is the parse scan in order.
 */
export function svgInferFrame(document: Document, input: SvgInferInput): SvgInferResult {
  const options = { anchorSlack: 6, chainDepth: 2, labelReach: 24, sampleSpacing: 8, ...input.options }
  const parsed = new DOMParser().parseFromString(withSvgNamespace(input.svg), "image/svg+xml")
  if (parsed.querySelector("parsererror") || parsed.documentElement.localName !== "svg") {
    throw new Error("Expected a valid SVG document")
  }

  const sourceBounds = sourceBoundsOf(parsed, parsed.documentElement)
  const rootId = input.rootId ?? "svg"
  const revisionId = `svg-infer:${documentFingerprint([input.svg, options])}`
  const host = document.createElement("div")
  host.setAttribute("style", "position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none")
  const root = document.importNode(parsed.documentElement, true) as unknown as SVGSVGElement
  // Measurement needs a pixel-for-unit root; the artifact keeps whatever the source declared.
  const declaredSize = ["width", "height", "style"].map(name => [name, root.getAttribute(name)] as const)
  root.style.width = `${sourceBounds.width}px`
  root.style.height = `${sourceBounds.height}px`
  host.appendChild(root)
  document.body.appendChild(host)

  const steps: SvgInferStep[] = []
  const step = (entry: SvgInferStep) => {
    steps.push(entry)
    input.onStep?.(entry)
  }
  const used = new Set<GraphId>([rootId])
  const elementIdByGraphId = new Map<GraphId, string>()
  const claim = (elementId: string): GraphId => {
    let id = elementId
    for (let suffix = 2; used.has(id); suffix += 1) id = `${elementId}~${suffix}`
    used.add(id)
    elementIdByGraphId.set(id, elementId)
    return id
  }

  try {
    const rootMatrix = root.getScreenCTM()
    if (rootMatrix === null) throw new Error("SVG root has no coordinate transform")
    const relay = (element: SVGGraphicsElement) => {
      const own = element.getScreenCTM()
      return own === null ? undefined : rootMatrix.inverse().multiply(own)
    }
    const boxOf = (element: SVGGraphicsElement, matrix: DOMMatrix): Rect => {
      const local = element.getBBox()
      const corners = [
        [local.x, local.y],
        [local.x + local.width, local.y],
        [local.x + local.width, local.y + local.height],
        [local.x, local.y + local.height],
      ].map(point => new DOMPoint(point[0], point[1]).matrixTransform(matrix))
      const xs = corners.map(point => point.x)
      const ys = corners.map(point => point.y)
      return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }
    }
    const hidden = (element: Element) => {
      for (let node: Element | null = element.parentElement; node !== null && node !== root; node = node.parentElement) {
        if (HIDDEN_ANCESTORS[node.tagName.toLowerCase()]) return true
      }
      return false
    }
    let anonymous = 0
    const idOf = (element: Element): string => {
      for (let node: Element | null = element; node !== null && node !== root; node = node.parentElement) {
        if (node.id !== "") return node.id
      }
      element.id = `inferred-${anonymous++}`
      return element.id
    }
    const distanceTo = (samples: readonly { x: number; y: number }[], point: { x: number; y: number }) =>
      samples.reduce((best, sample) => Math.min(best, Math.hypot(sample.x - point.x, sample.y - point.y)), Number.POSITIVE_INFINITY)

    const primitives = [...root.querySelectorAll("path,rect,circle,ellipse,line,polyline,polygon")]
      .filter((element): element is SVGGeometryElement => element instanceof SVGGeometryElement && !hidden(element))

    const areas: { id: GraphId; bounds: Rect; label?: string }[] = []
    const connectors: {
      id: GraphId
      samples: { x: number; y: number }[]
      start: { x: number; y: number }
      end: { x: number; y: number }
      forward: boolean
      backward: boolean
      dashed: boolean
      label?: string
    }[] = []

    for (const element of primitives) {
      const style = getComputedStyle(element)
      const length = element.getTotalLength()
      if (length <= 0) continue
      const head = element.getPointAtLength(0)
      const tail = element.getPointAtLength(length)
      const closed = CLOSED_TAGS[element.tagName.toLowerCase()] === true || Math.hypot(head.x - tail.x, head.y - tail.y) <= 1
      const filled = style.fill !== "none" && style.fillOpacity !== "0"
      const stroked = style.stroke !== "none"
      const markerEnd = style.markerEnd !== "none"
      const markerStart = style.markerStart !== "none"
      const matrix = relay(element)
      if (matrix === undefined) continue
      const elementId = idOf(element)

      if (closed && (filled || stroked)) {
        const bounds = boxOf(element, matrix)
        // A box covering the canvas is a backdrop: it is never a target and would swamp the view.
        if (bounds.width >= sourceBounds.width * 0.99 && bounds.height >= sourceBounds.height * 0.99) {
          step({ kind: "classify", elementId, role: "area", why: "backdrop, not a target" })
          continue
        }
        const id = claim(elementId)
        areas.push({ id, bounds })
        step({ kind: "classify", elementId, role: "area", why: `closed ${filled ? "filled" : "outline"}` })
        continue
      }
      if (!stroked && !markerEnd && !markerStart) continue
      const steps = Math.max(2, Math.min(512, Math.ceil(length / options.sampleSpacing)))
      const samples = Array.from({ length: steps + 1 }, (_, index) =>
        element.getPointAtLength((length * index) / steps).matrixTransform(matrix),
      )
      const id = claim(elementId)
      connectors.push({
        id,
        samples,
        start: samples[0],
        end: samples[samples.length - 1],
        forward: markerEnd,
        backward: markerStart,
        dashed: style.strokeDasharray !== "none",
      })
      step({ kind: "classify", elementId, role: "connector", why: `open stroke${markerEnd ? " with marker-end" : markerStart ? " with marker-start" : ""}` })
    }

    for (const element of [...root.querySelectorAll("text, foreignObject")]) {
      if (hidden(element)) continue
      const text = (element.textContent ?? "").replace(/\s+/g, " ").trim()
      if (text === "" || !(element instanceof SVGGraphicsElement)) continue
      const matrix = relay(element)
      if (matrix === undefined) continue
      const bounds = boxOf(element, matrix)
      const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
      const holder = areas
        .filter(area => center.x >= area.bounds.x && center.x <= area.bounds.x + area.bounds.width && center.y >= area.bounds.y && center.y <= area.bounds.y + area.bounds.height)
        .sort((left, right) => left.bounds.width * left.bounds.height - right.bounds.width * right.bounds.height)[0]
      if (holder !== undefined) {
        if (holder.label === undefined) {
          holder.label = text
          step({ kind: "label", graphId: holder.id, text })
        }
        continue
      }
      const near = connectors
        .map(connector => ({ connector, distance: distanceTo(connector.samples, center) }))
        .sort((left, right) => left.distance - right.distance)[0]
      if (near !== undefined && near.distance <= options.labelReach && near.connector.label === undefined) {
        near.connector.label = text
        step({ kind: "label", graphId: near.connector.id, text })
      }
    }

    /** Endpoints that land on another connector continue through it; the topmost landing area wins ties. */
    const through = (connector: typeof connectors[number], point: { x: number; y: number }, depth: number): { id: GraphId; distance: number; via: GraphId } | undefined => {
      const ends = [connector.start, connector.end]
      const nearFirst = distanceTo([ends[0]], point) < distanceTo([ends[1]], point) ? [ends[0], ends[1]] : [ends[1], ends[0]]
      const candidates = nearFirst.flatMap(end => {
        const behind = anchor(end, depth - 1, connector.id)
        return behind === undefined ? [] : [{ ...behind, distance: distanceTo(connector.samples, point), via: connector.id }]
      })
      if (candidates.length === 0) return undefined
      // A renderer that mirrors participants draws the same actor twice; the identity row sits at the top.
      const topOf = (id: GraphId) => areas.find(area => area.id === id)?.bounds.y ?? Number.POSITIVE_INFINITY
      candidates.sort((left, right) => topOf(left.id) - topOf(right.id) || left.distance - right.distance)
      return candidates[0] as { id: GraphId; distance: number; via: GraphId }
    }

    // How strongly a box claims a point: distance to its outline, measured from either side. A
    // point 4px outside a node (arrowhead clearance) is claimed; a point 20px inside a fragment
    // frame is claimed only if no connector passes nearer.
    const claimOf = (bounds: Rect, point: { x: number; y: number }): number | undefined => {
      const outside = Math.hypot(Math.max(bounds.x - point.x, 0, point.x - (bounds.x + bounds.width)), Math.max(bounds.y - point.y, 0, point.y - (bounds.y + bounds.height)))
      if (outside > 0) return outside <= options.anchorSlack ? outside : undefined
      return Math.min(point.x - bounds.x, bounds.x + bounds.width - point.x, point.y - bounds.y, bounds.y + bounds.height - point.y)
    }

    const anchor = (point: { x: number; y: number }, depth: number, selfId?: GraphId): { id: GraphId; distance: number; via?: GraphId } | undefined => {
      const hit = areas
        .flatMap(area => {
          const claim = claimOf(area.bounds, point)
          if (claim === undefined) return []
          return [{ area, claim }]
        })
        .sort((left, right) => left.claim - right.claim || left.area.bounds.width * left.area.bounds.height - right.area.bounds.width * right.area.bounds.height)[0]
      const touched = depth > 0
        ? connectors
            .filter(connector => connector.id !== selfId)
            .map(connector => ({ connector, distance: distanceTo(connector.samples, point) }))
            .filter(entry => entry.distance <= options.anchorSlack)
            .sort((left, right) => left.distance - right.distance)[0]
        : undefined
      if (touched !== undefined && (hit === undefined || touched.distance <= hit.claim)) return through(touched.connector, point, depth)
      if (hit !== undefined) {
        // A thin bar threaded by a line is furniture on that line (a sequence activation); the
        // line's own anchor is the target. Boxes wide enough to be real nodes keep the hit.
        const bar = Math.min(hit.area.bounds.width, hit.area.bounds.height) <= 16
        const threaded = bar && depth > 0
          ? connectors
              .filter(connector => connector.id !== selfId && connector.samples.some(sample =>
                sample.x >= hit.area.bounds.x - options.anchorSlack && sample.x <= hit.area.bounds.x + hit.area.bounds.width + options.anchorSlack &&
                sample.y >= hit.area.bounds.y - options.anchorSlack && sample.y <= hit.area.bounds.y + hit.area.bounds.height + options.anchorSlack))
              .sort((left, right) => distanceTo(left.samples, point) - distanceTo(right.samples, point))[0]
          : undefined
        if (threaded !== undefined) {
          const behind = through(threaded, point, depth)
          if (behind !== undefined) return behind
        }
        return { id: hit.area.id, distance: hit.claim }
      }
      return undefined
    }

    const edges: { id: GraphId; fromId: GraphId; toId: GraphId; direction: "none" | "forward" | "both"; dashed: boolean; label?: string }[] = []
    let lost = 0
    for (const connector of connectors) {
      const start = anchor(connector.start, options.chainDepth, connector.id)
      const end = anchor(connector.end, options.chainDepth, connector.id)
      step({ kind: "anchor", graphId: connector.id, end: "start", distance: start?.distance ?? Number.NaN, hit: start?.id, via: start?.via })
      step({ kind: "anchor", graphId: connector.id, end: "end", distance: end?.distance ?? Number.NaN, hit: end?.id, via: end?.via })
      if (start === undefined || end === undefined) {
        lost += 1
        step({ kind: "lost", graphId: connector.id, reason: start === undefined ? "start-unanchored" : "end-unanchored" })
        continue
      }
      const reverse = connector.backward && !connector.forward
      const fromId = reverse ? end.id : start.id
      const toId = reverse ? start.id : end.id
      const direction = connector.forward && connector.backward ? "both" : connector.forward || connector.backward ? "forward" : "none"
      edges.push({ id: connector.id, fromId, toId, direction, dashed: connector.dashed, ...(connector.label !== undefined ? { label: connector.label } : {}) })
      step({ kind: "edge", graphId: connector.id, fromId, toId, direction })
    }

    const graph: Record<GraphId, GraphItem<SvgInferNodeData, SvgInferEdgeData>> = {
      [rootId]: { id: rootId, type: "node", layout: { mode: "sealed", bounds: sourceBounds, geometryRevisionId: revisionId } },
    }
    const boundsById: Record<GraphId, Rect> = { [rootId]: sourceBounds }
    const endpointAnchorById: Record<GraphId, { x: number; y: number }> = {
      [rootId]: { x: sourceBounds.x + sourceBounds.width / 2, y: sourceBounds.y + sourceBounds.height / 2 },
    }
    const routesById: Record<GraphId, Float32Array> = {}
    const labelsById: Record<GraphId, { text: string }> = { [rootId]: { text: input.locator } }

    for (const area of areas) {
      graph[area.id] = { id: area.id, type: "node", data: { kind: "area", ...(area.label !== undefined ? { label: area.label } : {}) } }
      boundsById[area.id] = area.bounds
      endpointAnchorById[area.id] = { x: area.bounds.x + area.bounds.width / 2, y: area.bounds.y + area.bounds.height / 2 }
      labelsById[area.id] = { text: area.label ?? "" }
    }
    for (const edge of edges) {
      graph[edge.id] = {
        id: edge.id,
        type: "edge",
        fromId: edge.fromId,
        toId: edge.toId,
        direction: edge.direction,
        data: { kind: "connector", ...(edge.label !== undefined ? { label: edge.label } : {}), ...(edge.dashed ? { dashed: true } : {}) },
      }
      labelsById[edge.id] = { text: edge.label ?? "" }
    }
    for (const connector of connectors) {
      if (graph[connector.id] === undefined) continue
      const route = new Float32Array(connector.samples.length * 2)
      connector.samples.forEach((point, index) => {
        route[index * 2] = point.x
        route[index * 2 + 1] = point.y
      })
      routesById[connector.id] = route
      endpointAnchorById[connector.id] = connector.start
    }

    // Only items that survived into the graph may carry a binding; validateSealedSvgArtifacts rejects the rest.
    const bindings: { elementId: string; graphId: GraphId; role: "shape" | "connector"; ordinal: number }[] = []
    for (const graphId of Object.keys(graph)) {
      const elementId = elementIdByGraphId.get(graphId)
      if (elementId === undefined) continue
      bindings.push({ elementId, graphId, role: graph[graphId].type === "edge" ? "connector" : "shape", ordinal: bindings.length })
    }

    const geometry: GraphGeometry = { revisionId, boundsById, endpointAnchorById, routesById, headerBoundsById: {} }
    for (const [name, value] of declaredSize) {
      if (value === null) root.removeAttribute(name)
      else root.setAttribute(name, value)
    }
    const artifact: SealedSvgArtifact = {
      rootId,
      revisionId,
      geometryRevisionId: revisionId,
      svg: new XMLSerializer().serializeToString(root),
      source: { language: "svg", text: input.svg, locator: input.locator },
      sourceBounds,
      fit: "contain",
      bindings,
    }
    return {
      frame: {
        graph,
        geometry,
        camera: fitGraphCamera(geometry, { x: 0, y: 0, ...input.viewport }, 24),
        presentation: {
          stickyHeaders: [],
          hiddenIds: new Set(),
          focusedIds: new Set(),
          labelsById,
          sealedSvgArtifactsByRootId: validateSealedSvgArtifacts(graph, { [rootId]: artifact }),
        },
      },
      steps,
      counts: { primitives: primitives.length, areas: areas.length, connectors: connectors.length, edges: edges.length, lost },
    }
  } finally {
    host.remove()
  }
}
