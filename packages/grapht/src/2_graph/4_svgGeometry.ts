import type { GraphId, SvgBindingRole } from "@hafley66/grapht-model"
import type { GraphGeometry } from "./0_frame.js"
import type { Rect } from "../1_sequence/3_geometry.js"
import type { SealedSvgArtifact } from "./3_sealedSvgArtifact.js"

const NODE_SHAPE_ROLES = new Set<SvgBindingRole>(["actor-shape", "group-frame", "activation", "note-shape"])
const HEADER_ROLES = new Set<SvgBindingRole>(["group-label"])

export type SvgGraphPrimitive = {
  elementId: string
  graphId: GraphId
  role: SvgBindingRole
  ordinal: number
  bounds: Rect
  route?: Float32Array
}

function rectOf(element: SVGGraphicsElement, root: SVGSVGElement): Rect {
  const local = element.getBBox()
  const matrix = element.getCTM()
  const rootMatrix = root.getCTM()
  if (matrix === null || rootMatrix === null) throw new Error("bound SVG element has no coordinate transform")
  const inverseRoot = rootMatrix.inverse()
  const relative = inverseRoot.multiply(matrix)
  const points = [
    new DOMPoint(local.x, local.y),
    new DOMPoint(local.x + local.width, local.y),
    new DOMPoint(local.x, local.y + local.height),
    new DOMPoint(local.x + local.width, local.y + local.height),
  ].map(point => point.matrixTransform(relative))
  const xs = points.map(point => point.x)
  const ys = points.map(point => point.y)
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  }
}

function routeOf(element: SVGGraphicsElement, root: SVGSVGElement): Float32Array {
  const matrix = element.getCTM()
  const rootMatrix = root.getCTM()
  if (matrix === null || rootMatrix === null) throw new Error("bound SVG message line has no coordinate transform")
  const relative = rootMatrix.inverse().multiply(matrix)
  if (element instanceof SVGGeometryElement) {
    const length = element.getTotalLength()
    const samples = Math.max(2, Math.min(24, Math.ceil(length / 24)))
    const route = new Float32Array(samples * 2)
    for (let index = 0; index < samples; index++) {
      const point = element.getPointAtLength(length * index / (samples - 1)).matrixTransform(relative)
      route[index * 2] = point.x
      route[index * 2 + 1] = point.y
    }
    return route
  }
  const bounds = rectOf(element, root)
  return new Float32Array([bounds.x, bounds.y + bounds.height / 2, bounds.x + bounds.width, bounds.y + bounds.height / 2])
}

function union(left: Rect | undefined, right: Rect): Rect {
  if (left === undefined) return right
  const x = Math.min(left.x, right.x)
  const y = Math.min(left.y, right.y)
  const rightEdge = Math.max(left.x + left.width, right.x + right.width)
  const bottom = Math.max(left.y + left.height, right.y + right.height)
  return { x, y, width: rightEdge - x, height: bottom - y }
}

/** Injects the svg namespace into the root element only; nested roots inherit it and must not be touched. */
function withSvgNamespace(source: string): string {
  const root = /<svg\b[^>]*>/i.exec(source)
  if (!root || /\bxmlns\s*=/.test(root[0])) return source
  return `<svg xmlns="http://www.w3.org/2000/svg" ${source.slice(root.index + 4)}`
}

function parseSvg(document: Document, svg: string): SVGSVGElement {
  const parsed = new DOMParser().parseFromString(withSvgNamespace(svg), "image/svg+xml")
  if (parsed.querySelector("parsererror")) throw new Error(`sealed SVG artifact is not valid XML: ${parsed.querySelector("parsererror")?.textContent?.slice(0, 200)}`)
  for (const unsafe of parsed.querySelectorAll("script, foreignObject")) unsafe.remove()
  for (const element of parsed.querySelectorAll("*")) {
    for (const attribute of [...element.attributes]) {
      if (attribute.name.toLowerCase().startsWith("on")) element.removeAttribute(attribute.name)
    }
  }
  const imported = document.importNode(parsed.documentElement, true)
  if (!(imported instanceof SVGSVGElement)) throw new Error("sealed SVG artifact has no SVG root")
  return imported
}

/** Measures each bound SVG element without collapsing repeated roles onto its graph item. */
export function svgGraphPrimitivesOf(document: Document, artifact: SealedSvgArtifact): readonly SvgGraphPrimitive[] {
  const bindings = artifact.bindings ?? []
  const host = document.createElement("div")
  host.setAttribute("style", "position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none")
  const root = parseSvg(document, artifact.svg)
  root.style.width = `${artifact.sourceBounds.width}px`
  root.style.height = `${artifact.sourceBounds.height}px`
  host.appendChild(root)
  document.body.appendChild(host)

  try {
    return bindings.flatMap(binding => {
      const element = root.querySelector(`[id="${CSS.escape(binding.elementId)}"]`)
      if (!(element instanceof SVGGraphicsElement)) return []
      return [{
        elementId: binding.elementId,
        graphId: binding.graphId,
        role: binding.role,
        ordinal: binding.ordinal,
        bounds: rectOf(element, root),
        ...(binding.role === "message-line" ? { route: routeOf(element, root) } : {}),
      }]
    })
  } finally {
    host.remove()
  }
}

/** Measures bound SVG elements into canonical Grapht geometry in SVG viewBox coordinates. */
export function svgGraphGeometryOf(document: Document, artifact: SealedSvgArtifact): GraphGeometry {
  const primitives = svgGraphPrimitivesOf(document, artifact)
  const boundsById: Record<GraphId, Rect> = {}
  const endpointAnchorById: Record<GraphId, { x: number; y: number }> = {}
  const routesById: Record<GraphId, Float32Array> = {}
  const headerBoundsById: Record<GraphId, Rect> = {}

  for (const primitive of primitives) {
    if (NODE_SHAPE_ROLES.has(primitive.role)) boundsById[primitive.graphId] = union(boundsById[primitive.graphId], primitive.bounds)
    if (HEADER_ROLES.has(primitive.role)) headerBoundsById[primitive.graphId] = union(headerBoundsById[primitive.graphId], primitive.bounds)
    if (primitive.route !== undefined) routesById[primitive.graphId] = primitive.route
  }

  for (const [id, bounds] of Object.entries(boundsById)) {
    endpointAnchorById[id] = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
  }
  for (const [id, route] of Object.entries(routesById)) {
    if (route.length >= 2) endpointAnchorById[id] = { x: route[Math.floor(route.length / 4) * 2], y: route[Math.floor(route.length / 4) * 2 + 1] }
  }

  return {
    revisionId: artifact.geometryRevisionId,
    boundsById,
    endpointAnchorById,
    routesById,
    headerBoundsById,
  }
}
