// Pure restore math for sizing.ts. Kept in its own file so sizing.ts stays a thin store
// wrapper; nothing here reads or writes storage.
import type { Sizing } from './sizing'

function priorityRank(id: string, priority: string[]): number {
  const index = priority.indexOf(id)
  return index === -1 ? Number.POSITIVE_INFINITY : index
}

// Lowest priority first: higher rank (worse priority, including "absent" = Infinity) sorts first.
function byShrinkOrder(priority: string[]): (a: string, b: string) => number {
  return (a, b) => priorityRank(b, priority) - priorityRank(a, priority)
}

function highestPriority(candidates: string[], priority: string[]): string | undefined {
  return candidates.reduce<string | undefined>((best, id) => {
    if (best === undefined) return id
    return priorityRank(id, priority) < priorityRank(best, priority) ? id : best
  }, undefined)
}

// Shrink `px` in place until its total fits `viewportPx`, or every id is at its min.
// Auto ids shrink first (in shrink order), manual ids only once every auto id is at its min.
function shrinkToFit(
  px: Record<string, number>,
  autoIds: string[],
  manualIds: string[],
  viewportPx: number,
  mins: Record<string, number>,
  priority: string[],
): void {
  const total = Object.values(px).reduce((sum, value) => sum + value, 0)
  let overflow = total - viewportPx
  if (overflow <= 0) return
  const order = [...autoIds].sort(byShrinkOrder(priority)).concat([...manualIds].sort(byShrinkOrder(priority)))
  for (const id of order) {
    if (overflow <= 0) break
    const headroom = px[id] - (mins[id] ?? 0)
    const take = Math.min(headroom, overflow)
    if (take > 0) {
      px[id] -= take
      overflow -= take
    }
  }
}

// Hand any leftover width (viewportPx not yet spent) to the highest priority auto id, or the
// highest priority id overall when there is no auto id.
function growToFill(
  px: Record<string, number>,
  ids: string[],
  autoIds: string[],
  viewportPx: number,
  priority: string[],
): void {
  const total = Object.values(px).reduce((sum, value) => sum + value, 0)
  const remainder = viewportPx - total
  if (remainder <= 0) return
  const target = autoIds.length > 0 ? highestPriority(autoIds, priority) : highestPriority(ids, priority)
  if (target !== undefined) px[target] += remainder
}

// restoreSizing: step 1 manual scale, step 2 auto split, step 3 shrink/grow to fit,
// step 4 one deterministic px per id. See docstrings on the two helpers above for step 3.
export function restoreSizing(
  records: Record<string, Sizing>,
  ids: string[],
  viewportPx: number,
  mins: Record<string, number>,
  priority: string[] = [],
): Record<string, number> {
  const minOf = (id: string): number => mins[id] ?? 0
  // Manual requires a record with manual === true; a missing record is always auto.
  const isRecordedManual = (id: string): boolean => records[id]?.manual === true

  const manualIds = ids.filter(isRecordedManual)
  const autoIds = ids.filter((id) => !isRecordedManual(id))

  // Step 1: manual ids scale their recorded share to the new viewport, clamped to mins.
  const px: Record<string, number> = {}
  for (const id of manualIds) {
    const share = records[id].share
    px[id] = Math.max(minOf(id), Math.round(share * viewportPx))
  }

  // Step 2: auto ids split what manual ids left behind, weighted by last recorded share
  // (equal weight when absent), normalized so the weights sum to the remainder.
  const manualTotal = manualIds.reduce((sum, id) => sum + px[id], 0)
  const remaining = Math.max(0, viewportPx - manualTotal)
  const fallbackWeight = autoIds.length > 0 ? 1 / autoIds.length : 0
  const weights = autoIds.map((id) => records[id]?.share ?? fallbackWeight)
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1
  autoIds.forEach((id, index) => {
    const share = weights[index] / totalWeight
    px[id] = Math.max(minOf(id), Math.round(share * remaining))
  })

  // Step 3: reconcile the total against viewportPx (over shrinks, under grows).
  shrinkToFit(px, autoIds, manualIds, viewportPx, mins, priority)
  growToFill(px, ids, autoIds, viewportPx, priority)

  // Step 4: px now has exactly one entry per id in ids.
  return px
}
