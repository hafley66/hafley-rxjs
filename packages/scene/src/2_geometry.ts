import type { Geometry, Id } from "./0_types"

/** Build a geometry from per-id points. Ids missing from `points` land at the origin. */
export function geometryOf(ids: readonly Id[], points: ReadonlyMap<Id, readonly [number, number]>): Geometry {
  const pos = new Float32Array(ids.length * 2)
  for (let i = 0; i < ids.length; i++) {
    const p = points.get(ids[i])
    if (p) {
      pos[2 * i] = p[0]
      pos[2 * i + 1] = p[1]
    }
  }
  return { ids, pos }
}

const indexCache = new WeakMap<readonly Id[], ReadonlyMap<Id, number>>()

/** `id -> index` for one geometry, cached per `ids` array identity so per-frame callers pay once per layout. */
export function indexOf(g: Geometry): ReadonlyMap<Id, number> {
  let m = indexCache.get(g.ids)
  if (!m) {
    const built = new Map<Id, number>()
    for (let i = 0; i < g.ids.length; i++) built.set(g.ids[i], i)
    m = built
    indexCache.set(g.ids, m)
  }
  return m
}

/** Point for `id`, or `undefined`. Uses an index when supplied. */
export function pointOf(
  g: Geometry,
  id: Id,
  index: ReadonlyMap<Id, number> = indexOf(g),
): readonly [number, number] | undefined {
  const i = index.get(id)
  return i === undefined ? undefined : [g.pos[2 * i], g.pos[2 * i + 1]]
}

/** Axis-aligned bounds of all points: `[minX, minY, maxX, maxY]`. Empty geometry yields zeros. */
export function boundsOf(g: Geometry): readonly [number, number, number, number] {
  const n = g.ids.length
  if (n === 0) return [0, 0, 0, 0]
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (let i = 0; i < n; i++) {
    const x = g.pos[2 * i]
    const y = g.pos[2 * i + 1]
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return [minX, minY, maxX, maxY]
}
