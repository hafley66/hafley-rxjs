export type Camera = { scale: number; tx: number; ty: number }

export const IDENTITY_CAMERA: Camera = { scale: 1, tx: 0, ty: 0 }

export function worldToScreen(point: readonly [number, number], camera: Camera): [number, number] {
  return [point[0] * camera.scale + camera.tx, point[1] * camera.scale + camera.ty]
}

export function screenToWorld(point: readonly [number, number], camera: Camera): [number, number] {
  return [(point[0] - camera.tx) / camera.scale, (point[1] - camera.ty) / camera.scale]
}

export function pan(camera: Camera, dx: number, dy: number): Camera {
  return { scale: camera.scale, tx: camera.tx + dx, ty: camera.ty + dy }
}

export function zoomAt(camera: Camera, factor: number, sx: number, sy: number): Camera {
  const scale = camera.scale * factor
  const world = screenToWorld([sx, sy], camera)
  const tx = sx - world[0] * scale
  const ty = sy - world[1] * scale
  return { scale, tx, ty }
}

export function fitCamera(
  positions: Float32Array,
  canvasWidth: number,
  canvasHeight: number,
  padding = 40,
): Camera {
  if (positions.length === 0) return IDENTITY_CAMERA
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (let i = 0; i < positions.length; i += 2) {
    const x = positions[i]
    const y = positions[i + 1]
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  const spanX = Math.max(maxX - minX, 1)
  const spanY = Math.max(maxY - minY, 1)
  const scale = Math.min((canvasWidth - padding * 2) / spanX, (canvasHeight - padding * 2) / spanY)
  const tx = (canvasWidth - (minX + maxX) * scale) / 2
  const ty = (canvasHeight - (minY + maxY) * scale) / 2
  return { scale, tx, ty }
}

export type PickResult = { index: number; distance: number } | null

export function pickNearest(
  screenPoint: readonly [number, number],
  camera: Camera,
  positions: Float32Array,
  radius: number,
): PickResult {
  const world = screenToWorld(screenPoint, camera)
  let best: { index: number; distance: number } | null = null
  for (let i = 0; i < positions.length; i += 2) {
    const dx = (positions[i] - world[0]) * camera.scale
    const dy = (positions[i + 1] - world[1]) * camera.scale
    const d = Math.hypot(dx, dy)
    if (d <= radius && (best === null || d < best.distance)) {
      best = { index: i / 2, distance: d }
    }
  }
  return best
}
