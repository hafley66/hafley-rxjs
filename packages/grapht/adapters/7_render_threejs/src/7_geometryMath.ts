export type CameraState = { scale: number; tx: number; ty: number }

export type CameraViewport = { width: number; height: number }

// thickness is the full stroke width, matching the width a 2D stroke call would take.
export function edgeTriangles(positions: Float32Array, edges: [number, number][], thickness: number): {
  positions: Float32Array
  uvs: Float32Array
  indices: Uint32Array
} {
  const verts: number[] = []
  const indices: number[] = []
  for (const [a, b] of edges) {
    const ax = positions[a * 2]
    const ay = positions[a * 2 + 1]
    const bx = positions[b * 2]
    const by = positions[b * 2 + 1]
    const dx = bx - ax
    const dy = by - ay
    const len = Math.hypot(dx, dy) || 1
    const half = thickness / 2
    const nx = (-dy / len) * half
    const ny = (dx / len) * half
    const base = verts.length / 2
    verts.push(ax - nx, ay - ny, ax + nx, ay + ny, bx + nx, by + ny, bx - nx, by - ny)
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
  return {
    positions: new Float32Array(verts),
    uvs: new Float32Array((verts.length / 2) * 2),
    indices: new Uint32Array(indices),
  }
}

export function fitCamera(positions: Float32Array, viewport: CameraViewport, padding = 0.9): CameraState {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let index = 0; index < positions.length; index += 2) {
    if (positions[index] < minX) minX = positions[index]
    if (positions[index] > maxX) maxX = positions[index]
    if (positions[index + 1] < minY) minY = positions[index + 1]
    if (positions[index + 1] > maxY) maxY = positions[index + 1]
  }
  if (positions.length === 0) return { scale: 1, tx: viewport.width / 2, ty: viewport.height / 2 }
  const spanX = Math.max(1, maxX - minX)
  const spanY = Math.max(1, maxY - minY)
  const scale = Math.min(viewport.width / spanX, viewport.height / spanY) * padding
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  return {
    scale,
    tx: viewport.width / 2 - centerX * scale,
    ty: viewport.height / 2 - centerY * scale,
  }
}

export function zoomCamera(camera: CameraState, factor: number, anchorX: number, anchorY: number): CameraState {
  const k = factor
  return {
    scale: camera.scale * factor,
    tx: camera.tx * k + anchorX * (1 - k),
    ty: camera.ty * k + anchorY * (1 - k),
  }
}

export function panCamera(camera: CameraState, dx: number, dy: number): CameraState {
  return { scale: camera.scale, tx: camera.tx + dx, ty: camera.ty + dy }
}

export function worldToScreen(camera: CameraState, wx: number, wy: number): { x: number; y: number } {
  return { x: wx * camera.scale + camera.tx, y: wy * camera.scale + camera.ty }
}

export function screenToWorld(camera: CameraState, sx: number, sy: number): { x: number; y: number } {
  return { x: (sx - camera.tx) / camera.scale, y: (sy - camera.ty) / camera.scale }
}
