import { ROUTE_BINDING_ROLES, type SvgBindingRole } from "@hafley66/grapht-model"
import type { GraphFrame } from "../2_graph/0_frame.js"

/** Original element attributes belong to one mounted SVG and are restored before each projection. */
export type SvgMovementBase = Map<SVGElement, Record<string, string | null>>

export function applySvgMovement(root: SVGSVGElement, frame: GraphFrame, bindings: ReadonlyMap<SVGElement, string>, originals: SvgMovementBase): void {
  for (const [element] of bindings) {
    if (!originals.has(element)) originals.set(element, Object.fromEntries(["transform", "d", "points", "x1", "y1", "x2", "y2"].map(name => [name, element.getAttribute(name)])))
    for (const [name, value] of Object.entries(originals.get(element)!)) {
      if (value === null) element.removeAttribute(name); else element.setAttribute(name, value)
    }
  }
  const translations = frame.presentation.translationsById ?? {}
  if (!Object.keys(translations).length) return
  for (const [element, id] of bindings) {
    if (!(element instanceof SVGGraphicsElement)) continue
    const item = frame.graph[id]
    const matrix = element.getScreenCTM(), rootMatrix = root.getScreenCTM()
    if (!matrix || !rootMatrix) continue
    const toLocal = matrix.inverse().multiply(rootMatrix)
    const role = element.dataset.graphRole as SvgBindingRole | undefined
    const route = frame.geometry.routesById[id]
    if (item?.type === "edge" && role !== undefined && ROUTE_BINDING_ROLES[role] && route) {
      const points = Array.from({ length: route.length / 2 }, (_, i) => new DOMPoint(route[i * 2], route[i * 2 + 1]).matrixTransform(toLocal))
      if (element.tagName === "path") element.setAttribute("d", points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" "))
      else if (element.tagName === "line") for (const [name, value] of Object.entries({ x1: points[0].x, y1: points[0].y, x2: points.at(-1)!.x, y2: points.at(-1)!.y })) element.setAttribute(name, String(value))
      else if (element.tagName === "polyline") element.setAttribute("points", points.map(p => `${p.x},${p.y}`).join(" "))
      continue
    }
    let delta = translations[id]
    if (item?.type === "edge" && role === "message-label") {
      const from = translations[item.fromId], to = translations[item.toId]
      delta = { x: (delta?.x ?? 0) + ((from?.x ?? 0) + (to?.x ?? 0)) / 2, y: (delta?.y ?? 0) + ((from?.y ?? 0) + (to?.y ?? 0)) / 2 }
    }
    if (!delta) continue
    const vector = new DOMPoint(delta.x, delta.y).matrixTransform(toLocal), origin = new DOMPoint().matrixTransform(toLocal)
    // Append in element-local coordinates, preserving the source's existing transform.
    element.setAttribute("transform", `${originals.get(element)?.transform ?? ""} translate(${vector.x - origin.x} ${vector.y - origin.y})`)
  }
}
