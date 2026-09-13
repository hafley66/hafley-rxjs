import createDOMPurify from "dompurify"
import { layoutStickyRibbon, type RibbonItem } from "@hafley66/grapht-model"
import { foreignObjectsToText } from "../../src/2_graph/13_foreignObjectText.js"
import { stackGroupHeaders, type GroupHeader } from "../../src/2_graph/6_stackGroupHeaders.js"
import type { GraphCamera, GraphFrame, GraphGeometry } from "../../src/2_graph/0_frame.ts"
import type { GraphFrameResource } from "../../src/2_graph/10_renderer.ts"

export type DocumentRendererInteractions = {
  cameraInput$: { next: (camera: GraphCamera) => void }
}

export type DocumentStickyOptions = {
  inset?: number
  fullWidth?: number
  chipWidth?: number
  gap?: number
  height?: number
  ribbon?: boolean
  groups?: boolean
}

type DocumentGraphFrameResource = GraphFrameResource & {
  applyCamera: (camera: GraphCamera) => void
}

const SVG_NAMESPACE = "http://www.w3.org/2000/svg"

/** A condensed header has room for a mark, not a name: one letter per word, three at most. */
function initialsOf(label: string): string {
  const letters = label
    .split(/\s+/)
    .filter(word => word.length > 0)
    .map(word => word[0]?.toUpperCase() ?? "")
    .join("")
  return letters.slice(0, 3) || label.slice(0, 2).toUpperCase()
}

function sanitizedSvg(document: Document, source: string): SVGSVGElement {
  const window = document.defaultView
  if (window === null) throw new Error("document rendering requires a document window")
  const purifier = createDOMPurify(window)
  const fragment = purifier.sanitize(foreignObjectsToText(source), {
    USE_PROFILES: { svg: true, svgFilters: true },
    RETURN_DOM_FRAGMENT: true,
    FORBID_TAGS: ["foreignObject", "script"],
  })
  const svg = fragment.querySelector("svg")
  if (!(svg instanceof window.SVGSVGElement)) throw new Error("document artifact does not contain an svg root")
  return svg
}

function fitCamera(geometry: GraphGeometry, viewport: { width: number; height: number }): GraphCamera {
  let left = Number.POSITIVE_INFINITY
  let top = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY
  let bottom = Number.NEGATIVE_INFINITY
  for (const bounds of Object.values(geometry.boundsById)) {
    left = Math.min(left, bounds.x)
    top = Math.min(top, bounds.y)
    right = Math.max(right, bounds.x + bounds.width)
    bottom = Math.max(bottom, bounds.y + bounds.height)
  }
  const padding = 24
  const scale = Math.min((viewport.width - padding * 2) / (right - left), (viewport.height - padding * 2) / (bottom - top))
  return {
    x: viewport.width / 2 - ((left + right) / 2) * scale,
    y: viewport.height / 2 - ((top + bottom) / 2) * scale,
    scale,
    viewport: { x: 0, y: 0, width: viewport.width, height: viewport.height },
  }
}

// The sealed artifact is the interactive surface: the svg mounts once, camera
// writes write the root viewBox, and text selection works natively.
export function createDocumentGraphFrameResource(
  host: HTMLElement,
  interactions?: DocumentRendererInteractions,
  sticky: DocumentStickyOptions = {},
): DocumentGraphFrameResource {
  let camera: GraphCamera | undefined
  let root: SVGSVGElement | undefined
  let revisionId: string | undefined
  let ribbonItems: RibbonItem[] = []
  let ribbonLabels: Record<string, string> = {}
  let groupHeaders: GroupHeader[] = []
  let groupBounds: Record<string, { x: number; width: number }> = {}
  let groupGraph: GraphFrame["graph"] = {}
  let overlay: SVGSVGElement | undefined
  let ribbonLayer: SVGGElement | undefined
  let groupLayer: SVGGElement | undefined
  const painted = new Map<string, { group: SVGGElement; rect: SVGRectElement; text: SVGTextElement }>()
  const paintedGroups = new Map<string, { group: SVGGElement; rect: SVGRectElement; text: SVGTextElement }>()

  const inset = sticky.inset ?? 8
  const fullWidth = sticky.fullWidth ?? 60
  const chipWidth = sticky.chipWidth ?? 32
  const gap = sticky.gap ?? 4
  const headerHeight = sticky.height ?? 22
  const wantsRibbon = sticky.ribbon ?? true
  const wantsGroups = sticky.groups ?? true

  const ensureOverlay = (): { ribbon: SVGGElement; groups: SVGGElement } => {
    const document = host.ownerDocument
    if (overlay === undefined) {
      if (getComputedStyle(host).position === "static") host.style.position = "relative"
      const element = document.createElementNS(SVG_NAMESPACE, "svg")
      element.setAttribute("style", "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;overflow:visible")
      groupLayer = document.createElementNS(SVG_NAMESPACE, "g")
      groupLayer.setAttribute("data-sticky-groups", "")
      ribbonLayer = document.createElementNS(SVG_NAMESPACE, "g")
      ribbonLayer.setAttribute("data-sticky-ribbon", "")
      element.append(groupLayer, ribbonLayer)
      host.appendChild(element)
      overlay = element
    }
    return { ribbon: ribbonLayer as SVGGElement, groups: groupLayer as SVGGElement }
  }

  const upsert = (
    store: Map<string, { group: SVGGElement; rect: SVGRectElement; text: SVGTextElement }>,
    layer: SVGGElement,
    id: string,
    fill: string,
  ) => {
    const existing = store.get(id)
    if (existing !== undefined) return existing
    const document = host.ownerDocument
    const group = document.createElementNS(SVG_NAMESPACE, "g")
    group.setAttribute("data-sticky-id", id)
    const rect = document.createElementNS(SVG_NAMESPACE, "rect")
    rect.setAttribute("rx", "4")
    rect.setAttribute("fill", fill)
    rect.setAttribute("stroke", "#0D32B2")
    const text = document.createElementNS(SVG_NAMESPACE, "text")
    text.setAttribute("fill", "#0A0F25")
    text.setAttribute("style", "font:12px ui-monospace,Menlo,monospace")
    group.append(rect, text)
    layer.appendChild(group)
    const entry = { group, rect, text }
    store.set(id, entry)
    return entry
  }

  const sweep = (
    store: Map<string, { group: SVGGElement; rect: SVGRectElement; text: SVGTextElement }>,
    live: ReadonlySet<string>,
  ): void => {
    for (const [id, entry] of store) {
      if (live.has(id)) continue
      entry.group.remove()
      store.delete(id)
    }
  }

  const paintGroups = (next: GraphCamera): void => {
    if (!wantsGroups || groupHeaders.length === 0) return
    const layer = ensureOverlay().groups
    // Heights go in pre-divided by the camera scale, so a stacked slot is the same
    // screen height at any zoom and the bars stay readable.
    // The ribbon owns the first row, so the group stack starts under it.
    const top = inset + (wantsRibbon && ribbonItems.length > 0 ? headerHeight + gap : 0)
    const placements = stackGroupHeaders({
      graph: groupGraph,
      headers: groupHeaders.map(header => ({ ...header, height: headerHeight / next.scale })),
      camera: next,
      inset: top,
      gap,
    })
    const live = new Set<string>()
    for (const placement of placements) {
      if (!placement.visible) continue
      const bounds = groupBounds[placement.id]
      if (bounds === undefined) continue
      const bottomEdge = next.viewport.y + next.viewport.height - headerHeight
      if (placement.top < next.viewport.y || placement.top > bottomEdge) continue
      if (placement.state === "stuck" && placement.top < top) continue
      live.add(placement.id)
      const entry = upsert(paintedGroups, layer, placement.id, "#EDF0FD")
      const left = Math.max(next.viewport.x + inset, bounds.x * next.scale + next.x)
      const right = Math.min(next.viewport.x + next.viewport.width - inset, (bounds.x + bounds.width) * next.scale + next.x)
      entry.group.setAttribute("data-state", placement.state)
      entry.rect.setAttribute("x", String(left))
      entry.rect.setAttribute("y", String(placement.top))
      entry.rect.setAttribute("width", String(Math.max(0, right - left)))
      entry.rect.setAttribute("height", String(headerHeight))
      entry.text.setAttribute("x", String(left + 5))
      entry.text.setAttribute("y", String(placement.top + headerHeight - 7))
      entry.text.textContent = ribbonLabels[placement.id] ?? placement.id
    }
    sweep(paintedGroups, live)
  }

  const paintRibbon = (next: GraphCamera): void => {
    if (!wantsRibbon || ribbonItems.length === 0) return
    const layer = ensureOverlay().ribbon
    const document = host.ownerDocument
    const placements = layoutStickyRibbon({
      items: ribbonItems,
      camera: { x: next.x, y: next.y, scale: next.scale },
      viewport: next.viewport,
      inset,
      fullWidth,
      chipWidth,
      gap,
    })
    const live = new Set<string>()
    for (const placement of placements) {
      if (placement.state === "released") continue
      live.add(placement.id)
      const label = ribbonLabels[placement.id] ?? placement.id
      const entry = upsert(painted, layer, placement.id, "#E3E9FD")
      entry.group.setAttribute("data-detail", placement.detail)
      entry.rect.setAttribute("x", String(placement.left))
      entry.rect.setAttribute("y", String(placement.top))
      entry.rect.setAttribute("width", String(placement.width))
      entry.rect.setAttribute("height", String(headerHeight))
      entry.text.setAttribute("x", String(placement.left + 5))
      entry.text.setAttribute("y", String(placement.top + headerHeight - 7))
      entry.text.textContent = placement.detail === "chip" ? initialsOf(label) : label
    }
    sweep(painted, live)
  }

  const applyCamera = (next: GraphCamera): void => {
    camera = next
    paintGroups(next)
    paintRibbon(next)
    if (root === undefined) return
    const left = -next.x / next.scale
    const top = -next.y / next.scale
    root.setAttribute("viewBox", `${left} ${top} ${next.viewport.width / next.scale} ${next.viewport.height / next.scale}`)
  }

  const pointer = (event: { clientX: number; clientY: number }): { x: number; y: number } => ({
    x: event.clientX - host.getBoundingClientRect().left,
    y: event.clientY - host.getBoundingClientRect().top,
  })

  const onWheel = (event: WheelEvent): void => {
    if (camera === undefined) return
    event.preventDefault()
    // Shift scrolls horizontally, command or control zooms at the cursor
    // (ctrl carries the trackpad pinch), and a plain wheel pans.
    if (event.shiftKey) {
      const delta = event.deltaX !== 0 ? event.deltaX : event.deltaY
      applyCamera({ ...camera, x: camera.x - delta })
    } else if (event.metaKey || event.ctrlKey) {
      const at = pointer(event)
      const factor = Math.exp(-event.deltaY * 0.0015)
      const scale = Math.min(Math.max(camera.scale * factor, 0.01), 8)
      const worldX = (at.x - camera.x) / camera.scale
      const worldY = (at.y - camera.y) / camera.scale
      applyCamera({
        x: at.x - worldX * scale,
        y: at.y - worldY * scale,
        scale,
        viewport: camera.viewport,
      })
    } else {
      applyCamera({ ...camera, x: camera.x - event.deltaX, y: camera.y - event.deltaY })
    }
    interactions?.cameraInput$.next(camera)
  }

  let dragging: { pointerId: number; last: { x: number; y: number } } | undefined
  const onPointerDown = (event: PointerEvent): void => {
    if (camera === undefined || event.button !== 0) return
    // Text owns the gesture so selection works; everything else pans.
    if (event.target instanceof Element && event.target.closest("text, tspan")) return
    dragging = { pointerId: event.pointerId, last: pointer(event) }
    host.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: PointerEvent): void => {
    if (camera === undefined || dragging?.pointerId !== event.pointerId) return
    const at = pointer(event)
    applyCamera({ ...camera, x: camera.x + at.x - dragging.last.x, y: camera.y + at.y - dragging.last.y })
    dragging.last = at
    interactions?.cameraInput$.next(camera)
  }
  const onPointerUp = (event: PointerEvent): void => {
    if (dragging?.pointerId === event.pointerId) dragging = undefined
  }

  host.addEventListener("wheel", onWheel, { passive: false })
  host.addEventListener("pointerdown", onPointerDown)
  host.addEventListener("pointermove", onPointerMove)
  host.addEventListener("pointerup", onPointerUp)
  host.addEventListener("pointercancel", onPointerUp)

  return {
    render(frame) {
      const artifact = frame.presentation.sealedSvgArtifactsByRootId.epic ?? Object.values(frame.presentation.sealedSvgArtifactsByRootId)[0]
      if (artifact === undefined) return
      if (revisionId !== artifact.revisionId) {
        root?.remove()
        root = sanitizedSvg(host.ownerDocument, artifact.svg)
        root.setAttribute("width", "100%")
        root.setAttribute("height", "100%")
        root.style.userSelect = "text"
        root.style.display = "block"
        host.appendChild(root)
        revisionId = artifact.revisionId
        overlay?.remove()
        overlay = undefined
        ribbonLayer = undefined
        groupLayer = undefined
        painted.clear()
        paintedGroups.clear()
      }
      const columns = frame.geometry.columnBoundsById ?? {}
      ribbonItems = Object.entries(columns)
        .map(([id, bounds], index) => ({ id, left: bounds.x, width: bounds.width, top: bounds.y, bottom: bounds.y + bounds.height, order: index }))
        .sort((left, right) => left.left - right.left)
        .map((item, order) => ({ ...item, order }))
      ribbonLabels = Object.fromEntries(Object.entries(frame.presentation.labelsById).map(([id, label]) => [id, label.text]))
      groupGraph = frame.graph
      groupBounds = Object.fromEntries(
        Object.entries(frame.geometry.headerBoundsById).map(([id, header]) => [id, { x: header.x, width: header.width }]),
      )
      groupHeaders = Object.entries(frame.geometry.headerBoundsById)
        .map(([id, header]) => ({
          id,
          naturalTop: header.y,
          boundaryBottom: (frame.geometry.boundsById[id]?.y ?? header.y) + (frame.geometry.boundsById[id]?.height ?? header.height),
          height: header.height,
          order: header.y,
        }))
        .sort((left, right) => left.naturalTop - right.naturalTop)
      applyCamera(frame.camera)
    },
    applyCamera,
    unsubscribe() {
      host.removeEventListener("wheel", onWheel)
      host.removeEventListener("pointerdown", onPointerDown)
      host.removeEventListener("pointermove", onPointerMove)
      host.removeEventListener("pointerup", onPointerUp)
      host.removeEventListener("pointercancel", onPointerUp)
      root?.remove()
      root = undefined
      overlay?.remove()
      overlay = undefined
      ribbonLayer = undefined
      groupLayer = undefined
      painted.clear()
      paintedGroups.clear()
      ribbonItems = []
      groupHeaders = []
      revisionId = undefined
    },
  }
}

export { fitCamera as fitDocumentCamera }
