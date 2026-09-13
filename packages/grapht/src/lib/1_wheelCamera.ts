// Shared wheel interpretation for graph renderers; coordinates are local to the graph viewport.
import type { GraphCamera } from "../2_graph/0_frame.js"

export function wheelCamera(camera: GraphCamera, event: Pick<WheelEvent, "deltaX" | "deltaY" | "deltaMode" | "shiftKey" | "ctrlKey" | "metaKey">, at: { x: number; y: number }): GraphCamera {
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? camera.viewport.height : 1
  const dx = event.deltaX * unit
  const dy = event.deltaY * unit
  if (event.shiftKey) return { ...camera, x: camera.x - (dx !== 0 ? dx : dy) }
  if (event.metaKey || event.ctrlKey) {
    const scale = Math.min(Math.max(camera.scale * Math.exp(-dy * 0.0015), 0.01), 8)
    return { ...camera, x: at.x - (at.x - camera.x) * scale / camera.scale, y: at.y - (at.y - camera.y) * scale / camera.scale, scale }
  }
  return { ...camera, x: camera.x - dx, y: camera.y - dy }
}
