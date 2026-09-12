import createDOMPurify from "dompurify"
import { foreignObjectsToText } from "../../src/2_graph/13_foreignObjectText.js"
import type { GraphCamera, GraphFrame, GraphGeometry } from "../../src/2_graph/0_frame.ts"
import type { GraphFrameResource } from "../../src/2_graph/10_renderer.ts"

export type DocumentRendererInteractions = {
  cameraInput$: { next: (camera: GraphCamera) => void }
}

type DocumentGraphFrameResource = GraphFrameResource & {
  applyCamera: (camera: GraphCamera) => void
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
): DocumentGraphFrameResource {
  let camera: GraphCamera | undefined
  let root: SVGSVGElement | undefined
  let revisionId: string | undefined

  const applyCamera = (next: GraphCamera): void => {
    camera = next
    if (root === undefined) return
    const left = -next.x / next.scale
    const top = -next.y / next.scale
    root.setAttribute("viewBox", `${left} ${top} ${next.viewport.width / next.scale} ${next.viewport.height / next.scale}`)
  }

  const pointer = (event: PointerEvent): { x: number; y: number } => ({
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
      }
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
      revisionId = undefined
    },
  }
}

export { fitCamera as fitDocumentCamera }
