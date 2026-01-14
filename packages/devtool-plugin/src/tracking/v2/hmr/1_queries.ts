/**
 * HMR Track Queries
 */

import type { State } from "../00.types"

/**
 * Find hmr_track by key (location string like "outer" or "outer:inner")
 * Store is keyed by surrogate id, so we need to scan.
 */
export function findTrackByKey(state: State, key: string) {
  return Object.values(state.store.hmr_track).find(t => t.key === key)
}

/**
 * Derive structural path by walking parent_track_id chain
 *
 * @returns Path like "0:pipe|0:map|1:filter|2:scan"
 */
export function deriveStructuralPath(state: State, trackId: string): string {
  const segments: string[] = []
  let current = state.store.hmr_track[trackId]

  while (current) {
    const name = current.key.split(":").pop() ?? current.key
    segments.unshift(`${current.index}:${name}`)

    if (!current.parent_track_id) break
    current = state.store.hmr_track[current.parent_track_id]
  }

  return segments.join("|")
}
