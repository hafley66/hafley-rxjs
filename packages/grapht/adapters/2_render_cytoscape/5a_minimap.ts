import cytoscape, { type Core } from "cytoscape"
import navigator from "cytoscape-navigator"
import type { GraphStyle } from "../../src/lib/0_graphStyle.js"

let ordinal = 0
let registered = false

export function createMinimap(cy: Core, host: HTMLElement, theme: GraphStyle) {
  if (!registered) { cytoscape.use(navigator); registered = true }
  const el = host.ownerDocument.createElement("div")
  el.id = `grapht-minimap-${++ordinal}`
  el.dataset.graphtMinimap = ""
  el.setAttribute("aria-label", "Graph minimap")
  el.title = "Overview (axes compressed independently): click or drag to navigate; scroll to zoom"
  el.style.cssText = `position:absolute;right:16px;bottom:36px;width:200px;height:150px;overflow:hidden;z-index:8;border:1px solid ${theme.nodeBorder};border-radius:6px;background:${theme.canvasBackground}`
  const style = host.ownerDocument.createElement("style")
  style.textContent = `#${el.id}>img{max-width:100%;max-height:100%}#${el.id}>canvas{position:absolute;top:0;left:0;z-index:1}#${el.id}>.cytoscape-navigatorView{position:absolute;top:0;left:0;cursor:move;background:#fbbf2433;outline:2px solid #fbbf24;z-index:2}#${el.id}>.cytoscape-navigatorOverlay{position:absolute;inset:0;z-index:3}`
  el.append(style)
  host.append(el)
  const nav = cy.navigator({ container: `#${el.id}`, viewLiveFramerate: 0, removeCustomContainer: true }) as navigator.Nav & {
    _onRenderHandler: (() => void) & { cancel(): void }
    _removeCyListeners(): void
    _setupView(): void
    _moveCy(): void
    $thumbnail: HTMLImageElement
    $view: HTMLDivElement
    viewLocked: boolean
    viewX: number; viewY: number; viewW: number; viewH: number
  }
  // Navigator 2.0.2 owns input handling. Replace its uniform-scale PNG projection:
  // a tall FS tree otherwise becomes a one-pixel line. Bounds and camera use the
  // same independent X/Y scales, with a cached schematic overview at panel size.
  nav._removeCyListeners()
  nav._onRenderHandler.cancel()
  const canvas = host.ownerDocument.createElement("canvas")
  canvas.width = 200; canvas.height = 150
  const context = canvas.getContext("2d")!
  let x1 = 0, y1 = 0, sx = 1, sy = 1
  const view = () => {
    if (nav.viewLocked) return
    const extent = cy.extent()
    nav.viewX = 8 + (extent.x1 - x1) * sx
    nav.viewY = 8 + (extent.y1 - y1) * sy
    nav.viewW = extent.w * sx
    nav.viewH = extent.h * sy
    nav.$view.style.cssText = `left:${nav.viewX}px;top:${nav.viewY}px;width:${nav.viewW}px;height:${nav.viewH}px;min-width:3px;min-height:3px`
  }
  nav._setupView = view
  nav._moveCy = () => {
    cy.pan({ x: -(x1 + (nav.viewX - 8) / sx) * cy.zoom(), y: -(y1 + (nav.viewY - 8) / sy) * cy.zoom() })
  }
  const draw = () => {
    const nodes = cy.nodes().filter(node => node.visible())
    if (!nodes.length) {
      context.clearRect(0, 0, 200, 150)
      nav.$thumbnail.src = canvas.toDataURL("image/png")
      nav.$view.hidden = true
      return
    }
    nav.$view.hidden = false
    const bounds = cy.elements().filter(element => element.visible()).boundingBox({ includeLabels: false, includeOverlays: false })
    x1 = bounds.x1; y1 = bounds.y1
    sx = 184 / Math.max(1, bounds.w); sy = 134 / Math.max(1, bounds.h)
    context.clearRect(0, 0, 200, 150)
    context.strokeStyle = "#64748b"
    context.lineWidth = 0.5
    context.beginPath()
    for (const edge of cy.edges()) {
      if (!edge.visible()) continue
      const points = [edge.sourceEndpoint(), ...(edge.segmentPoints() ?? []), edge.targetEndpoint()]
      points.forEach((point, index) => {
        const x = 8 + (point.x - x1) * sx, y = 8 + (point.y - y1) * sy
        if (index === 0) context.moveTo(x, y)
        else context.lineTo(x, y)
      })
    }
    context.stroke()
    context.fillStyle = "#93c5fd"
    for (const node of nodes) {
      const box = node.boundingBox({ includeLabels: false, includeOverlays: false })
      context.fillRect(8 + (box.x1 - x1) * sx, 8 + (box.y1 - y1) * sy, Math.max(1, box.w * sx), Math.max(1, box.h * sy))
    }
    nav.$thumbnail.src = canvas.toDataURL("image/png")
    nav.$thumbnail.style.cssText = "position:absolute;inset:0;width:200px;height:150px"
    view()
  }
  let pending: number | undefined
  const refresh = () => {
    if (pending !== undefined) return
    pending = requestAnimationFrame(() => { pending = undefined; draw() })
  }
  cy.on("pan zoom", view)
  cy.on("resize free", refresh)
  refresh()
  // Keep minimap wheel input out of the renderer's main-camera wheel handler.
  const wheel = (event: WheelEvent) => {
    event.preventDefault()
    event.stopPropagation()
    cy.zoom({ level: cy.zoom() * Math.exp(-event.deltaY * 0.002), renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } })
  }
  el.addEventListener("wheel", wheel, { passive: false })
  return { el, refresh, unsubscribe() {
    if (pending !== undefined) cancelAnimationFrame(pending)
    nav._onRenderHandler.cancel()
    cy.off("pan zoom", view)
    cy.off("resize free", refresh)
    el.removeEventListener("wheel", wheel)
    nav.destroy()
  } }
}
