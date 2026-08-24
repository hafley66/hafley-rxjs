import type { Viewport } from "pixi-viewport"

export type ViewportWheelGesture =
  | { type: "pinch" }
  | { type: "pan"; x: number; y: number }

export function projectViewportWheel(event: Pick<WheelEvent, "ctrlKey" | "metaKey" | "deltaX" | "deltaY">): ViewportWheelGesture {
  if (event.ctrlKey) return { type: "pinch" }
  if (event.metaKey) return { type: "pan", x: -(event.deltaX || event.deltaY), y: 0 }
  return { type: "pan", x: -event.deltaX, y: -event.deltaY }
}

export function installViewportWheel(viewport: Viewport): { unsubscribe(): void } {
  const element = viewport.options.events.domElement
  const wheel = (event: WheelEvent) => {
    const gesture = projectViewportWheel(event)
    if (gesture.type === "pinch") return
    event.preventDefault()
    viewport.x += gesture.x
    viewport.y += gesture.y
    viewport.plugins.get("clamp")?.update()
    viewport.emit("moved", { viewport, type: "wheel" })
  }
  element.addEventListener("wheel", wheel, { passive: false })
  return { unsubscribe: () => element.removeEventListener("wheel", wheel) }
}
