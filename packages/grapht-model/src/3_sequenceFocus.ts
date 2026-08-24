import type { SequenceArtifact } from "./2_sequenceArtifact.js"

export type SequenceFocus = { hoveredOccurrenceId?: string; actorIds: string[]; groupIds: string[] }

export function resolveSequenceFocus(artifact: SequenceArtifact, occurrenceId: string): SequenceFocus {
  const hovered = artifact.occurrences.find(occurrence => occurrence.id === occurrenceId)
  if (!hovered) return { actorIds: [], groupIds: [] }
  const actorIds = new Set<string>()
  if (hovered.kind === "actor") actorIds.add(hovered.id)
  if (hovered.kind === "group") {
    for (const occurrence of artifact.occurrences) {
      if (occurrence.kind === "actor") actorIds.add(occurrence.id)
    }
  }
  for (const relation of artifact.relations) {
    if (hovered.kind === "message" && relation.kind === "message" && relation.occurrenceId === hovered.id) {
      actorIds.add(relation.sourceId)
      actorIds.add(relation.targetId)
    }
    if (hovered.kind === "activation" && relation.kind === "activates" && relation.sourceId === hovered.id)
      actorIds.add(relation.targetId)
  }
  const groups: string[] = []
  let parentId = hovered.parentId
  while (parentId) {
    const parent = artifact.occurrences.find(occurrence => occurrence.id === parentId)
    if (!parent) break
    if (parent.kind === "group") groups.unshift(parent.id)
    parentId = parent.parentId
  }
  return {
    hoveredOccurrenceId: hovered.id,
    actorIds: artifact.occurrences.filter(occurrence => actorIds.has(occurrence.id)).map(occurrence => occurrence.id),
    groupIds: groups,
  }
}
