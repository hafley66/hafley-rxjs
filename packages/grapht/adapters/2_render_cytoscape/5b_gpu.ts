import type { Core, SingularElementReturnValue, EdgeSingular } from "cytoscape"

export function supportsWebgl(document: Document): boolean {
  const gl = document.createElement("canvas").getContext("webgl2")
  if (!gl) return false
  gl.getExtension("WEBGL_lose_context")?.loseContext()
  return true
}

/** Cytoscape 3.34 drawing hooks. Cull submissions, preserving element IDs, picking
 * indexes, graph bounds and Canvas PNG export used by the minimap. */
export function cullWebgl(cy: Core): void {
  type Draw = (element: SingularElementReturnValue, index: number, type?: string) => void
  type Drawing = Record<"drawNode" | "drawTexture" | "drawEdgeLine" | "drawEdgeArrow", Draw> & {
    startFrame: (...args: unknown[]) => void
    _getEdgePoints: (edge: EdgeSingular) => number[] | undefined
    graphtStats?: { submitted: number; culled: number }
  }
  const drawing = (cy as unknown as { renderer(): { drawing?: Drawing } }).renderer().drawing
  if (!drawing) return
  // 3.34 treats segment bends as Bezier controls. Submit their straight spans
  // separately so FS elbows remain exact in both colour and picking passes.
  const edgePoints = drawing._getEdgePoints, edgeLine = drawing.drawEdgeLine
  let span: number[] | undefined
  drawing._getEdgePoints = function (edge) { return span ?? edgePoints.call(this, edge) }
  drawing.drawEdgeLine = function (element, index) {
    if (element.style("curve-style") !== "segments") return edgeLine.call(this, element, index)
    const edge = element as EdgeSingular
    const points = [edge.sourceEndpoint(), ...edge.segmentPoints(), edge.targetEndpoint()]
    try {
      for (let i = 1; i < points.length; i++) {
        span = [points[i - 1].x, points[i - 1].y, points[i].x, points[i].y]
        edgeLine.call(this, element, index)
      }
    } finally { span = undefined }
  }
  const start = drawing.startFrame
  let extent = cy.extent(), padding = 0
  let dirty = true
  let boxes = new WeakMap<SingularElementReturnValue, ReturnType<SingularElementReturnValue["boundingBox"]> | null>()
  // All elements remain owned by cy; cy.destroy() releases these listeners.
  cy.on("add remove position style data bounds", () => { dirty = true })
  let previous: SingularElementReturnValue | undefined, visible = true
  const stats = drawing.graphtStats = { submitted: 0, culled: 0 }
  drawing.startFrame = function (...args) {
    if (dirty) { boxes = new WeakMap(); dirty = false }
    extent = cy.extent()
    padding = 64 / cy.zoom()
    previous = undefined
    stats.submitted = stats.culled = 0
    return start.apply(this, args)
  }
  for (const key of ["drawNode", "drawTexture", "drawEdgeLine", "drawEdgeArrow"] as const) {
    const draw = drawing[key]
    drawing[key] = function (element, index, type) {
      if (element !== previous) {
        previous = element
        // Cytoscape caches this box and invalidates it on geometry/style changes.
        // Include labels and entire edge routes, including crossing edges whose
        // endpoints are both outside the viewport.
        let box = boxes.get(element)
        if (box === undefined) {
          box = element.visible() ? element.boundingBox() : null
          boxes.set(element, box)
        }
        visible = box !== null && box.x2 >= extent.x1 - padding && box.x1 <= extent.x2 + padding
          && box.y2 >= extent.y1 - padding && box.y1 <= extent.y2 + padding
        if (visible) stats.submitted++
        else stats.culled++
      }
      if (visible) return draw.call(this, element, index, type)
    }
  }
}
