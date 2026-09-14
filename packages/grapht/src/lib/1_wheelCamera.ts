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
