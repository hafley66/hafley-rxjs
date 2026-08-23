import type { IdentityReceipt } from "./0_sequenceIdentity.js"
import type { SequenceArtifact } from "./2_sequenceArtifact.js"

export type SequencePlacement = {
  viewId: string
  occurrenceId: string
  baseGeometryRevisionId: string
  delta: { x: number; y: number }
  source: "manual"
}

export type PlacementBlockReason = "ambiguous" | "missing-previous" | "not-retained"
export type PlacementReconciliation = {
  rebased: SequencePlacement[]
  blocked: Array<{ placement: SequencePlacement; reason: PlacementBlockReason }>
}

function sameRetainedOccurrence(
  previous: SequenceArtifact["occurrences"][number],
  next: SequenceArtifact["occurrences"][number],
): boolean {
  if (previous.id === next.id) return true
  if (previous.authoredId && next.authoredId) return previous.authoredId === next.authoredId
  return previous.structuralKey === next.structuralKey
}

export function reconcileSequencePlacements(
  previousArtifact: SequenceArtifact,
  nextArtifact: SequenceArtifact,
  identity: IdentityReceipt,
  placements: SequencePlacement[],
  nextGeometryRevisionId: string,
): PlacementReconciliation {
  const previousById = new Map(previousArtifact.occurrences.map(occurrence => [occurrence.id, occurrence]))
  const retained = new Set(identity.retained)
  const ambiguousPrevious = new Set(identity.ambiguities.flatMap(ambiguity => ambiguity.candidatePreviousIds))
  const rebased: SequencePlacement[] = []
  const blocked: PlacementReconciliation["blocked"] = []

  for (const placement of placements) {
    const previous = previousById.get(placement.occurrenceId)
    if (!previous) {
      blocked.push({ placement: { ...placement, delta: { ...placement.delta } }, reason: "missing-previous" })
      continue
    }
    if (ambiguousPrevious.has(previous.id)) {
      blocked.push({ placement: { ...placement, delta: { ...placement.delta } }, reason: "ambiguous" })
      continue
    }
    const candidates = nextArtifact.occurrences.filter(
      next => retained.has(next.id) && sameRetainedOccurrence(previous, next),
    )
    if (candidates.length !== 1) {
      blocked.push({ placement: { ...placement, delta: { ...placement.delta } }, reason: "not-retained" })
      continue
    }
    rebased.push({
      ...placement,
      occurrenceId: candidates[0].id,
      baseGeometryRevisionId: nextGeometryRevisionId,
      delta: { ...placement.delta },
    })
  }

  return { rebased, blocked }
}
