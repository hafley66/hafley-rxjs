export type ShakeOffset = { dx: number; dy: number }

// Camera the shake scenario measured, captured immediately after fitCamera().
export type ShakeCameraState = { tx: number; ty: number; zoom: number }

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// [dx0, dy0, dx1, dy1, ...]: absolute displacement from camera rest, uniform in [-amplitudePx, amplitudePx].
// Frame index and seed are the only inputs, and the last frame is exactly (0, 0) so the camera lands at rest.
export function shakeOffsets(seed: number, amplitudePx: number, frames: number): Float32Array {
  const count = Number.isFinite(frames) ? Math.max(0, Math.floor(frames)) : 0
  const offsets = new Float32Array(count * 2)
  if (count === 0) return offsets
  const random = mulberry32(seed)
  for (let index = 0; index < count - 1; index++) {
    offsets[index * 2] = (random() * 2 - 1) * amplitudePx
    offsets[index * 2 + 1] = (random() * 2 - 1) * amplitudePx
  }
  offsets[(count - 1) * 2] = 0
  offsets[(count - 1) * 2 + 1] = 0
  return offsets
}

export function shakeOffsetAt(offsets: Float32Array, frame: number): ShakeOffset {
  return { dx: offsets[frame * 2] ?? 0, dy: offsets[frame * 2 + 1] ?? 0 }
}
