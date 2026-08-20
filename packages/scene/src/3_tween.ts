import type { Diff, Geometry, Tween } from "./0_types"
import { indexOf } from "./2_geometry"

export type Easing = (t: number) => number

export const linear: Easing = t => t
export const easeInOutCubic: Easing = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

/** Output order is `to.ids`; keep lerps, enter holds at `to`, exit is absent. Reuses `out`; rebuilds the id index only when `from` changes. */
export function tween(easing: Easing = linear): Tween {
  let lastFrom: Geometry | undefined
  let fromIndex: ReadonlyMap<string, number> = new Map()
  return (from, to, _diff: Diff, t, out) => {
    if (from !== lastFrom) {
      lastFrom = from
      fromIndex = indexOf(from)
    }
    const n = to.ids.length
    const pos = out && out.length === n * 2 ? out : new Float32Array(n * 2)
    const k = easing(t < 0 ? 0 : t > 1 ? 1 : t)
    for (let i = 0; i < n; i++) {
      const j = fromIndex.get(to.ids[i])
      const tx = to.pos[2 * i]
      const ty = to.pos[2 * i + 1]
      if (j === undefined) {
        pos[2 * i] = tx
        pos[2 * i + 1] = ty
      } else {
        const fx = from.pos[2 * j]
        const fy = from.pos[2 * j + 1]
        pos[2 * i] = fx + (tx - fx) * k
        pos[2 * i + 1] = fy + (ty - fy) * k
      }
    }
    return { ids: to.ids, pos, size: to.size, routes: to.routes }
  }
}
