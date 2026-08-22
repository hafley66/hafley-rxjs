import type { EntityId, GraphEntity, GraphTopology, SequenceCollapseState, SequenceFocus } from "./0_types.js"

function entityById(topology: GraphTopology): Map<EntityId, GraphEntity> {
  return new Map(topology.entities.map((entity) => [entity.id, entity]))
}

export function resolveSequenceFocus(topology: GraphTopology, entityId: EntityId): SequenceFocus {
  const entities = entityById(topology)
  const hovered = entities.get(entityId)
  if (!hovered) return { hoveredEntityId: entityId, actorIds: [], groupIds: [] }

  const actorIds = new Set<EntityId>()
  const groupIds = new Set<EntityId>()
  if (hovered.kind === "actor") actorIds.add(hovered.id)
  if (hovered.kind === "activation" && hovered.parentId) actorIds.add(hovered.parentId)

  for (const relation of topology.relations) {
    if (relation.id !== entityId && relation.sourceId !== entityId && relation.targetId !== entityId) continue
    const source = entities.get(relation.sourceId)
    const target = entities.get(relation.targetId)
    if (source?.kind === "actor") actorIds.add(source.id)
    if (target?.kind === "actor") actorIds.add(target.id)
  }

  let current: GraphEntity | undefined = hovered
  while (current?.parentId) {
    current = entities.get(current.parentId)
    if (current?.kind === "group") groupIds.add(current.id)
  }

  return { hoveredEntityId: entityId, actorIds: [...actorIds], groupIds: [...groupIds] }
}

export function toggleSequenceGroup(state: SequenceCollapseState, groupId: EntityId): SequenceCollapseState {
  const current = new Set(state.collapsedGroupIds)
  if (current.has(groupId)) current.delete(groupId)
  else current.add(groupId)
  return { collapsedGroupIds: [...current] }
}
