import { documentFingerprint } from "./12_sequenceIdentity.js"
import type { SequenceArtifact } from "./14_sequenceArtifact.js"
import type { EntityGeometry, Rect, SequenceGeometry } from "./15_sequenceGeometry.js"

export type SequenceCollapseState = { collapsedGroupIds: string[] }

type CollapseInterval = { start: number; end: number; delta: number }

function descendantIds(artifact: SequenceArtifact, groupId: string): Set<string> {
  const ids = new Set<string>()
  const parents = [groupId]

  while (parents.length > 0) {
    const parentId = parents.pop()
    for (const occurrence of artifact.occurrences) {
      if (occurrence.parentId !== parentId) continue
      ids.add(occurrence.id)
      parents.push(occurrence.id)
    }
  }

  return ids
}

function projectRect(bounds: Rect, interval: CollapseInterval): Rect {
  if (bounds.y >= interval.end) return { ...bounds, y: bounds.y - interval.delta }
  if (bounds.y + bounds.height <= interval.start) return { ...bounds }
  return { ...bounds, height: Math.max(0, bounds.height - interval.delta) }
}

function projectEntity(entity: EntityGeometry, intervals: CollapseInterval[]): EntityGeometry {
  const worldBounds = intervals.reduce((bounds, interval) => projectRect(bounds, interval), entity.worldBounds)
  const moved = entity.worldBounds.y - worldBounds.y
  return {
    ...entity,
    localBounds: { ...entity.localBounds },
    worldBounds,
    transform: { ...entity.transform, f: entity.transform.f - moved },
  }
}

export function projectCollapsedSequence(
  artifact: SequenceArtifact,
  geometry: SequenceGeometry,
  state: SequenceCollapseState,
): SequenceGeometry {
  if (state.collapsedGroupIds.length === 0) return geometry

  const occurrenceIndex = new Map(artifact.occurrences.map((occurrence, index) => [occurrence.id, index]))
  const requested = [...new Set(state.collapsedGroupIds)]
    .map(id => artifact.occurrences.find(occurrence => occurrence.id === id))
    .filter((occurrence): occurrence is NonNullable<typeof occurrence> => occurrence?.kind === "group")
    .sort((left, right) => (occurrenceIndex.get(left.id) ?? 0) - (occurrenceIndex.get(right.id) ?? 0))
  const requestedIds = new Set(requested.map(group => group.id))
  const groups = requested.filter(group => {
    let parentId = group.parentId
    while (parentId) {
      if (requestedIds.has(parentId)) return false
      parentId = artifact.occurrences.find(occurrence => occurrence.id === parentId)?.parentId
    }
    return true
  })
  const hidden = new Set<string>()
  const intervals: CollapseInterval[] = []

  for (const group of groups) {
    const descendants = descendantIds(artifact, group.id)
    const descendantsGeometry = geometry.entities.filter(entity => descendants.has(entity.occurrenceId))
    for (const id of descendants) hidden.add(id)
    if (descendantsGeometry.length === 0) continue
    const start = Math.min(...descendantsGeometry.map(entity => entity.worldBounds.y))
    const end = Math.max(...descendantsGeometry.map(entity => entity.worldBounds.y + entity.worldBounds.height))
    if (end > start) intervals.push({ start, end, delta: end - start })
  }

  const sortedIntervals = intervals.sort((left, right) => left.start - right.start)
  let priorDelta = 0
  const adjustedIntervals = sortedIntervals.map(interval => {
    const adjusted = { ...interval, start: interval.start - priorDelta, end: interval.end - priorDelta }
    priorDelta += interval.delta
    return adjusted
  })
  const delta = sortedIntervals.reduce((total, interval) => total + interval.delta, 0)
  const collapsedIds = groups.map(group => group.id)

  return {
    ...geometry,
    id: `geometry:collapse:${documentFingerprint([geometry.id, collapsedIds])}`,
    viewBox: { ...geometry.viewBox, height: geometry.viewBox.height - delta },
    entities: geometry.entities
      .filter(entity => !hidden.has(entity.occurrenceId))
      .map(entity => projectEntity(entity, adjustedIntervals)),
    diagnostics: geometry.diagnostics.map(diagnostic => ({ ...diagnostic })),
    browser: { ...geometry.browser },
  }
}
