import type { EntityId, GraphEntity, GraphTopology } from "./0_types.js"

export type EntityMatch = {
  retained: EntityId[]
  inserted: EntityId[]
  removed: EntityId[]
  ambiguous: EntityId[]
}

export function entityIdOf(language: string, entity: Pick<GraphEntity, "kind" | "sourceKey" | "parentId" | "ordinal">): EntityId {
  const source = entity.sourceKey ?? `ordinal:${entity.ordinal}`
  return [language, entity.kind, entity.parentId ?? "root", source].join("/")
}

export function topologyWithIds(topology: GraphTopology): GraphTopology {
  const entities = topology.entities.map((entity) => ({
    ...entity,
    id: entity.id || entityIdOf(topology.language, entity),
  }))
  const ids = new Set<string>()
  for (const entity of entities) {
    if (ids.has(entity.id)) throw new Error(`duplicate graph entity ID: ${entity.id}`)
    ids.add(entity.id)
  }
  for (const relation of topology.relations) {
    if (!ids.has(relation.sourceId) || !ids.has(relation.targetId)) {
      throw new Error(`graph relation references unknown entity: ${relation.id}`)
    }
  }
  return { ...topology, entities }
}

function fingerprint(entity: GraphEntity): string {
  return [entity.kind, entity.parentId ?? "root", entity.sourceKey ?? "", entity.label ?? ""].join("|")
}

export function matchEntities(previous: GraphEntity[], next: GraphEntity[]): EntityMatch {
  const previousById = new Map(previous.map((entity) => [entity.id, entity]))
  const previousByFingerprint = new Map<string, GraphEntity[]>()
  for (const entity of previous) {
    const list = previousByFingerprint.get(fingerprint(entity)) ?? []
    list.push(entity)
    previousByFingerprint.set(fingerprint(entity), list)
  }

  const retained: EntityId[] = []
  const inserted: EntityId[] = []
  const ambiguous: EntityId[] = []
  const seenPrevious = new Set<EntityId>()
  for (const entity of next) {
    const exact = previousById.get(entity.id)
    if (exact && !seenPrevious.has(exact.id)) {
      retained.push(entity.id)
      seenPrevious.add(exact.id)
      continue
    }
    const candidates = (previousByFingerprint.get(fingerprint(entity)) ?? []).filter((candidate) => !seenPrevious.has(candidate.id))
    if (candidates.length === 1) {
      retained.push(entity.id)
      seenPrevious.add(candidates[0].id)
    } else if (candidates.length > 1) {
      inserted.push(entity.id)
      ambiguous.push(entity.id)
    } else {
      inserted.push(entity.id)
    }
  }

  const removed = previous.filter((entity) => !seenPrevious.has(entity.id)).map((entity) => entity.id)
  return { retained, inserted, removed, ambiguous }
}
