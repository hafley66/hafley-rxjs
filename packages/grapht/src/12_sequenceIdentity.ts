export type SequenceOccurrenceKind = "actor" | "message" | "group" | "activation" | "note"

export type SequenceSourceSpan = {
  start: number
  end: number
  lineStart: number
  lineEnd: number
}

export type SequenceOccurrence = {
  id: string
  kind: SequenceOccurrenceKind
  parentId?: string
  ordinal: number
  sourceSpan?: SequenceSourceSpan
  authoredId?: string
  structuralKey: string
  label?: string
}

export type SequenceRelation = {
  id: string
  kind: "message" | "contains" | "activates"
  sourceId: string
  targetId: string
  ordinal: number
}

export type SequenceOccurrenceDocument = {
  language: "mermaid" | "d2"
  occurrences: SequenceOccurrence[]
  relations: SequenceRelation[]
}

export type RelationDiagnostic = {
  code: "SEQUENCE_DUPLICATE_OCCURRENCE_ID" | "SEQUENCE_DUPLICATE_RELATION_ID" | "SEQUENCE_MISSING_RELATION_ENDPOINT"
  message: string
}

export type RelationValidation = {
  valid: boolean
  diagnostics: RelationDiagnostic[]
}

export type IdentityAmbiguity = {
  nextOccurrenceId: string
  candidatePreviousIds: string[]
  reason: "repeated-structure" | "reordered-structure" | "missing-source-identity"
}

export type PlacementSafetyReceipt = {
  transferableOccurrenceIds: string[]
  blockedOccurrenceIds: string[]
}

export type IdentityReceipt = {
  retained: string[]
  inserted: string[]
  removed: string[]
  ambiguities: IdentityAmbiguity[]
  placement: PlacementSafetyReceipt
}

export function documentFingerprint(value: unknown): string {
  let hash = 0x811c9dc5

  for (const character of JSON.stringify(value)) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193)
  }

  return (hash >>> 0).toString(16).padStart(8, "0")
}

export function occurrenceId(language: SequenceOccurrenceDocument["language"], revision: string, key: string): string {
  return `${language}:${revision}:${key}`
}

export function validateSequenceRelations(document: SequenceOccurrenceDocument): RelationValidation {
  const diagnostics: RelationDiagnostic[] = []
  const occurrenceIds = new Set<string>()
  const relationIds = new Set<string>()

  for (const occurrence of document.occurrences) {
    if (occurrenceIds.has(occurrence.id)) {
      diagnostics.push({
        code: "SEQUENCE_DUPLICATE_OCCURRENCE_ID",
        message: `duplicate occurrence ID: ${occurrence.id}`,
      })
    }
    occurrenceIds.add(occurrence.id)
  }

  for (const relation of document.relations) {
    if (relationIds.has(relation.id)) {
      diagnostics.push({
        code: "SEQUENCE_DUPLICATE_RELATION_ID",
        message: `duplicate relation ID: ${relation.id}`,
      })
    }
    relationIds.add(relation.id)

    for (const endpoint of [relation.sourceId, relation.targetId]) {
      if (!occurrenceIds.has(endpoint)) {
        diagnostics.push({
          code: "SEQUENCE_MISSING_RELATION_ENDPOINT",
          message: `relation ${relation.id} references missing occurrence: ${endpoint}`,
        })
      }
    }
  }

  return { valid: diagnostics.length === 0, diagnostics }
}

function groupedByStructuralKey(occurrences: SequenceOccurrence[]) {
  const groups = new Map<string, SequenceOccurrence[]>()

  for (const occurrence of occurrences) {
    const group = groups.get(occurrence.structuralKey) ?? []
    group.push(occurrence)
    groups.set(occurrence.structuralKey, group)
  }

  return groups
}

function hasReorderedAnchor(
  previousCandidates: SequenceOccurrence[],
  nextCandidates: SequenceOccurrence[],
  previous: SequenceOccurrence[],
  next: SequenceOccurrence[],
): boolean {
  if (previousCandidates.length !== nextCandidates.length || previousCandidates.length < 2) {
    return false
  }

  const previousGroups = groupedByStructuralKey(previous)
  const nextGroups = groupedByStructuralKey(next)

  for (const [key, previousAnchors] of previousGroups) {
    const nextAnchors = nextGroups.get(key)

    if (!nextAnchors || previousAnchors.length !== 1 || nextAnchors.length !== 1) {
      continue
    }

    const previousBefore = previousCandidates.filter(candidate => candidate.ordinal < previousAnchors[0].ordinal).length
    const nextBefore = nextCandidates.filter(candidate => candidate.ordinal < nextAnchors[0].ordinal).length

    if (previousBefore !== nextBefore) {
      return true
    }
  }

  return false
}

export function matchSequenceRevisions(previous: SequenceOccurrence[], next: SequenceOccurrence[]): IdentityReceipt {
  const previousById = new Map(previous.map(occurrence => [occurrence.id, occurrence]))
  const nextById = new Map(next.map(occurrence => [occurrence.id, occurrence]))
  const unmatchedPrevious = new Set(previousById.keys())
  const unmatchedNext = new Set(nextById.keys())
  const retained: string[] = []
  const ambiguities: IdentityAmbiguity[] = []

  const retain = (previousId: string, nextId: string) => {
    unmatchedPrevious.delete(previousId)
    unmatchedNext.delete(nextId)
    retained.push(nextId)
  }

  const previousByAuthoredId = new Map<string, SequenceOccurrence[]>()
  const nextByAuthoredId = new Map<string, SequenceOccurrence[]>()

  for (const occurrence of previous) {
    if (!occurrence.authoredId) continue
    const group = previousByAuthoredId.get(occurrence.authoredId) ?? []
    group.push(occurrence)
    previousByAuthoredId.set(occurrence.authoredId, group)
  }

  for (const occurrence of next) {
    if (!occurrence.authoredId) continue
    const group = nextByAuthoredId.get(occurrence.authoredId) ?? []
    group.push(occurrence)
    nextByAuthoredId.set(occurrence.authoredId, group)
  }

  for (const [authoredId, previousCandidates] of previousByAuthoredId) {
    const nextCandidates = nextByAuthoredId.get(authoredId)

    if (previousCandidates.length === 1 && nextCandidates?.length === 1) {
      retain(previousCandidates[0].id, nextCandidates[0].id)
    }
  }

  const previousByStructure = groupedByStructuralKey(
    previous.filter(occurrence => unmatchedPrevious.has(occurrence.id)),
  )
  const nextByStructure = groupedByStructuralKey(next.filter(occurrence => unmatchedNext.has(occurrence.id)))

  for (const [structuralKey, nextCandidates] of nextByStructure) {
    const previousCandidates = previousByStructure.get(structuralKey) ?? []

    if (previousCandidates.length === 1 && nextCandidates.length === 1) {
      retain(previousCandidates[0].id, nextCandidates[0].id)
      continue
    }

    if (previousCandidates.length > 1 && nextCandidates.length > 0) {
      const reason = hasReorderedAnchor(previousCandidates, nextCandidates, previous, next)
        ? "reordered-structure"
        : "repeated-structure"

      for (const nextOccurrence of nextCandidates) {
        ambiguities.push({
          nextOccurrenceId: nextOccurrence.id,
          candidatePreviousIds: previousCandidates.map(occurrence => occurrence.id),
          reason,
        })
      }
    }
  }

  const inserted = next.filter(occurrence => unmatchedNext.has(occurrence.id)).map(occurrence => occurrence.id)
  const removed = previous.filter(occurrence => unmatchedPrevious.has(occurrence.id)).map(occurrence => occurrence.id)
  const blockedOccurrenceIds = ambiguities.map(ambiguity => ambiguity.nextOccurrenceId)

  return {
    retained,
    inserted,
    removed,
    ambiguities,
    placement: {
      transferableOccurrenceIds: retained,
      blockedOccurrenceIds,
    },
  }
}
