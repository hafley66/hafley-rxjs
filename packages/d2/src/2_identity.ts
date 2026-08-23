import {
  documentFingerprint,
  occurrenceId,
  type SequenceOccurrence,
  type SequenceOccurrenceDocument,
  type SequenceRelation,
} from "../../grapht/src/12_sequenceIdentity"
import type { D2Edge, D2Group, D2Note, D2SequenceDocument, D2Statement } from "./0_types"

function actorStructuralKey(id: string): string {
  return `actor:${id}`
}

function endpointKey(endpoint: D2Edge["source"]): string {
  return endpoint.span ? `${endpoint.actor}.${endpoint.span}` : endpoint.actor
}

export function identifyD2Occurrences(document: D2SequenceDocument): SequenceOccurrenceDocument {
  const revision = documentFingerprint(document)
  const occurrences: SequenceOccurrence[] = []
  const relations: SequenceRelation[] = []
  const actorIds = new Map<string, string>()
  const groupIds = new Map<string, string>()
  const groupStructuralKeys = new Map<string, string>()
  let relationOrdinal = 0

  const addRelation = (kind: SequenceRelation["kind"], sourceId: string, targetId: string, occurrenceId?: string) => {
    relations.push({
      id: `d2:${revision}:relation:${relationOrdinal}`,
      kind,
      ...(occurrenceId ? { occurrenceId } : {}),
      sourceId,
      targetId,
      ordinal: relationOrdinal++,
    })
  }

  for (const actor of document.actors) {
    const id = occurrenceId("d2", revision, actor.key)
    actorIds.set(actor.id, id)
    occurrences.push({
      id,
      kind: "actor",
      ordinal: actor.ordinal,
      sourceSpan: actor.sourceSpan,
      authoredId: actor.id,
      structuralKey: actorStructuralKey(actor.id),
      label: actor.label,
    })
  }

  const lowerStatement = (statement: D2Statement, parentId: string | undefined, parentKey: string) => {
    if (statement.kind === "directive") return
    if (statement.kind === "group") {
      lowerGroup(statement, parentId, parentKey)
      return
    }

    const id = occurrenceId("d2", revision, statement.key)
    occurrences.push(lowerLeaf(statement, id, parentId, parentKey))
    if (parentId) addRelation("contains", parentId, id)
    if (statement.kind === "edge") {
      addRelation(
        "message",
        actorIds.get(statement.source.actor) ?? statement.source.actor,
        actorIds.get(statement.target.actor) ?? statement.target.actor,
        id,
      )
    }
  }

  const lowerGroup = (statement: D2Group, parentId: string | undefined, parentKey: string) => {
    const id = occurrenceId("d2", revision, statement.key)
    const structuralKey = `group:${parentKey}/${statement.label}`
    groupIds.set(statement.key, id)
    groupStructuralKeys.set(statement.key, structuralKey)
    occurrences.push({
      id,
      kind: "group",
      ...(parentId ? { parentId } : {}),
      ordinal: statement.ordinal,
      sourceSpan: statement.sourceSpan,
      structuralKey,
      label: statement.label,
    })
    if (parentId) addRelation("contains", parentId, id)
    for (const child of statement.statements) lowerStatement(child, id, structuralKey)
  }

  for (const statement of document.statements) lowerStatement(statement, undefined, "root")

  for (const span of document.spans) {
    const id = occurrenceId("d2", revision, span.key)
    const parentId = span.parentGroupKey ? groupIds.get(span.parentGroupKey) : undefined
    const parentKey = span.parentGroupKey ? (groupStructuralKeys.get(span.parentGroupKey) ?? "root") : "root"
    occurrences.push({
      id,
      kind: "activation",
      ...(parentId ? { parentId } : {}),
      ordinal: span.ordinal,
      sourceSpan: span.sourceSpan,
      authoredId: `${span.actor}.${span.name}`,
      structuralKey: `activation:${parentKey}/${span.actor}.${span.name}`,
      label: span.name,
    })
    if (parentId) addRelation("contains", parentId, id)
    addRelation("activates", id, actorIds.get(span.actor) ?? span.actor, id)
  }

  return { language: "d2", occurrences, relations }
}

function lowerLeaf(
  statement: D2Edge | D2Note,
  id: string,
  parentId: string | undefined,
  parentKey: string,
): SequenceOccurrence {
  if (statement.kind === "edge") {
    return {
      id,
      kind: "message",
      ...(parentId ? { parentId } : {}),
      ordinal: statement.ordinal,
      sourceSpan: statement.sourceSpan,
      structuralKey: `message:${parentKey}/${endpointKey(statement.source)}->${endpointKey(statement.target)}:${statement.label}`,
      label: statement.label,
    }
  }

  return {
    id,
    kind: "note",
    ...(parentId ? { parentId } : {}),
    ordinal: statement.ordinal,
    sourceSpan: statement.sourceSpan,
    structuralKey: `note:${parentKey}/${statement.actor}:${statement.label}`,
    label: statement.label,
  }
}
