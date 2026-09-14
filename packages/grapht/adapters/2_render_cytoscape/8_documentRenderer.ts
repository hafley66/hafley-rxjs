import { graphStyleOf, type GraphStyle, type GraphStyleInput } from "../../src/lib/0_graphStyle.js"
import { applySvgStyle } from "../../src/lib/2_svgStyle.js"
import { WheelMomentum } from "../../src/lib/2_wheelMomentum.js"
import createDOMPurify from "dompurify"
import { createStickyOverlay, type StickyOptions } from "../../src/lib/0_stickyOverlay.js"
import { foreignObjectsToText } from "../../src/2_graph/13_foreignObjectText.js"
import { createGestureLegend, type GestureLegendHandle } from "../../src/2_graph/14_gestureLegend.js"
import type { GraphCamera, GraphFrame, GraphGeometry } from "../../src/2_graph/0_frame.ts"
import type { GraphFrameResource } from "../../src/2_graph/10_renderer.ts"

export type DocumentRendererInteractions = {
  cameraInput$: { next: (camera: GraphCamera) => void }
}

export type DocumentStickyOptions = StickyOptions

type DocumentGraphFrameResource = GraphFrameResource & {
  applyTheme: (style: GraphStyleInput) => void
  applyCamera: (camera: GraphCamera) => void
  applySticky: (sticky: Pick<DocumentStickyOptions, "ribbon" | "groups">) => void
  legend: GestureLegendHandle
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
  const originalBackground = host.style.background
  let theme: GraphStyle | undefined
  let camera: GraphCamera | undefined
  let root: SVGSVGElement | undefined
  let revisionId: string | undefined
  const stickyOverlay = createStickyOverlay(host, sticky)
  const legend = createGestureLegend(host)
  const applyCamera = (next: GraphCamera): void => {
    camera = next
    stickyOverlay.applyCamera(next)
    if (root === undefined) return
    const left = -next.x / next.scale
    const top = -next.y / next.scale
    root.setAttribute("viewBox", `${left} ${top} ${next.viewport.width / next.scale} ${next.viewport.height / next.scale}`)
  }

  const pointer = (event: { clientX: number; clientY: number }): { x: number; y: number } => ({
    x: event.clientX - host.getBoundingClientRect().left,
    y: event.clientY - host.getBoundingClientRect().top,
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
    if (camera === undefined) return
    const next = momentum.step(camera, now)
    if (next === undefined) return
    applyCamera(next)
    interactions?.cameraInput$.next(next)
    momentumFrame = requestAnimationFrame(coast)
  }

  const onWheel = (event: WheelEvent): void => {
    if (camera === undefined) return
    event.preventDefault()
    applyCamera(momentum.push(camera, event, pointer(event), performance.now()))
    if (!momentumFrame) momentumFrame = requestAnimationFrame(coast)
    interactions?.cameraInput$.next(camera)
  }

  let dragging: { pointerId: number; last: { x: number; y: number } } | undefined
  const onPointerDown = (event: PointerEvent): void => {
    if (camera === undefined || event.button !== 0) return
    // Text owns the gesture so selection works, and page chrome owns its own clicks: capturing the
    // pointer here would retarget their click event to the host and swallow it. Everything else pans.
    if (event.target instanceof Element && event.target.closest("text, tspan, [data-gesture-legend]")) return
    unsubscribeMomentum()
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
      unsubscribeMomentum()
      const artifact = frame.presentation.sealedSvgArtifactsByRootId.epic ?? Object.values(frame.presentation.sealedSvgArtifactsByRootId)[0]
      if (artifact === undefined) return
      if (revisionId !== artifact.revisionId) {
        root?.remove()
        root = sanitizedSvg(host.ownerDocument, artifact.svg)
        if (theme) applySvgStyle(root, theme)
        root.setAttribute("width", "100%")
        root.setAttribute("height", "100%")
        root.style.userSelect = "text"
        root.style.display = "block"
        host.appendChild(root)
        revisionId = artifact.revisionId
      }
      stickyOverlay.render(frame)
      applyCamera(frame.camera)
    },
    applyTheme(next) {
      theme = graphStyleOf(next)
      host.style.background = theme.canvasBackground
      stickyOverlay.applyTheme(theme)
      if (root) applySvgStyle(root, theme)
    },
    applyCamera(next) { unsubscribeMomentum(); applyCamera(next) },
    applySticky: stickyOverlay.applySticky,
    legend,
    unsubscribe() {
      unsubscribeMomentum()
      host.removeEventListener("wheel", onWheel)
      host.removeEventListener("pointerdown", onPointerDown)
      host.removeEventListener("pointermove", onPointerMove)
      host.removeEventListener("pointerup", onPointerUp)
      host.removeEventListener("pointercancel", onPointerUp)
      root?.remove()
      host.style.background = originalBackground
      root = undefined
      legend.remove()
      stickyOverlay.unsubscribe()
      revisionId = undefined
    },
  }
}

export { fitCamera as fitDocumentCamera }
