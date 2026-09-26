// Shared wheel interpretation for graph renderers; coordinates are local to the graph viewport.
import type { GraphCamera } from "../2_graph/0_frame.js"

export type WheelSettings = { zoomSensitivity: number; momentum: boolean; strength: number; decayMs: number; maxDurationMs: number }
export const DEFAULT_WHEEL_SETTINGS: Readonly<WheelSettings> = Object.freeze({ zoomSensitivity: 1.2, momentum: true, strength: 1, decayMs: 85, maxDurationMs: 500 })

/** Validate persisted/URL values before they reach camera arithmetic. */
export function wheelSettingsOf(input: unknown): WheelSettings {
  const value = input && typeof input === "object" ? input as Partial<WheelSettings> : {}
  const settings = { ...DEFAULT_WHEEL_SETTINGS }
  for (const [key, min, max] of [["zoomSensitivity", 0.2, 3], ["strength", 0, 2], ["decayMs", 20, 300], ["maxDurationMs", 100, 1500]] as const) {
    const number = value[key]
    if (typeof number === "number" && Number.isFinite(number)) settings[key] = Math.min(max, Math.max(min, number))
  }
  if (typeof value.momentum === "boolean") settings.momentum = value.momentum
  return settings
}

export function wheelCamera(camera: GraphCamera, event: Pick<WheelEvent, "deltaX" | "deltaY" | "deltaMode" | "shiftKey" | "ctrlKey" | "metaKey">, at: { x: number; y: number }, zoomSensitivity = DEFAULT_WHEEL_SETTINGS.zoomSensitivity): GraphCamera {
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? camera.viewport.height : 1
  const dx = event.deltaX * unit
  const dy = event.deltaY * unit
  if (event.shiftKey) return { ...camera, x: camera.x - (dx !== 0 ? dx : dy) }
  if (event.metaKey || event.ctrlKey) {
    const scale = Math.min(Math.max(camera.scale * Math.exp(-dy * 0.0015 * zoomSensitivity), 0.01), 8)
    return { ...camera, x: at.x - (at.x - camera.x) * scale / camera.scale, y: at.y - (at.y - camera.y) * scale / camera.scale, scale }
  }
  return { ...camera, x: camera.x - dx, y: camera.y - dy }
}

export type DrawBounds = { x: number; y: number; width: number; height: number }

/** The scale at which `bounds` fits the viewport on both axes. */
export function fitScaleOf(bounds: DrawBounds, viewport: { width: number; height: number }): number {
  if (bounds.width <= 0 || bounds.height <= 0 || viewport.width <= 0 || viewport.height <= 0) return 1
  return Math.min(viewport.width / bounds.width, viewport.height / bounds.height)
}

/** Keep the drawing on screen: on each axis, empty space between a drawing edge and the facing
 * viewport edge is at most `slack` of the viewport, and the scale never drops below `minScale`.
 * A scale raised to the floor keeps the viewport center still. */
export function clampCamera(camera: GraphCamera, bounds: DrawBounds, minScale = 0, slack = 0.5): GraphCamera {
  const { width, height } = camera.viewport
  const scale = Math.max(camera.scale, minScale)
  const x = width / 2 - (width / 2 - camera.x) * scale / camera.scale
  const y = height / 2 - (height / 2 - camera.y) * scale / camera.scale
  // pseudo: left edge <= slack*width, right edge >= (1-slack)*width, same for y.
  const clampAxis = (at: number, start: number, size: number, extent: number) =>
    Math.min(slack * extent - start * scale, Math.max((1 - slack) * extent - (start + size) * scale, at))
  return {
    ...camera,
    scale,
    x: clampAxis(x, bounds.x, bounds.width, width),
    y: clampAxis(y, bounds.y, bounds.height, height),
  }
}

export function sameCamera(left: GraphCamera, right: GraphCamera): boolean {
  return Math.abs(left.x - right.x) < 0.5 && Math.abs(left.y - right.y) < 0.5 && Math.abs(left.scale - right.scale) < 1e-6
}
