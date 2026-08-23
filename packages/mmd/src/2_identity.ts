import {
  documentFingerprint,
  occurrenceId,
  type SequenceOccurrence,
  type SequenceOccurrenceDocument,
  type SequenceRelation,
} from "../../grapht/src/12_sequenceIdentity"
import type {
  MermaidActivationStatement,
  MermaidGroupStatement,
  MermaidMessageStatement,
  MermaidNoteStatement,
  MermaidSequenceDocument,
  MermaidStatement,
} from "./0_types"

function actorStructuralKey(id: string): string {
  return `actor:${id}`
}

export function identifyMermaidOccurrences(document: MermaidSequenceDocument): SequenceOccurrenceDocument {
  const revision = documentFingerprint(document)
  const occurrences: SequenceOccurrence[] = []
  const relations: SequenceRelation[] = []
  const actorIds = new Map<string, string>()
  let relationOrdinal = 0

  const addRelation = (kind: SequenceRelation["kind"], sourceId: string, targetId: string, occurrenceId?: string) => {
    relations.push({
      id: `mermaid:${revision}:relation:${relationOrdinal}`,
      kind,
      ...(occurrenceId ? { occurrenceId } : {}),
      sourceId,
      targetId,
      ordinal: relationOrdinal++,
    })
  }

  for (const participant of document.participants) {
    const id = occurrenceId("mermaid", revision, participant.key)
    actorIds.set(participant.id, id)
    occurrences.push({
      id,
      kind: "actor",
      ordinal: participant.ordinal,
      sourceSpan: participant.sourceSpan,
      structuralKey: actorStructuralKey(participant.id),
      label: participant.label,
    })
  }

  const lowerStatement = (statement: MermaidStatement, parentId: string | undefined, parentKey: string) => {
    if (statement.kind === "group") {
      lowerGroup(statement, parentId, parentKey)
      return
    }

    const id = occurrenceId("mermaid", revision, statement.key)
    const occurrence = lowerLeaf(statement, id, parentId, parentKey)
    occurrences.push(occurrence)

    if (parentId) addRelation("contains", parentId, id)

    if (statement.kind === "message") {
      addRelation(
        "message",
        actorIds.get(statement.from) ?? statement.from,
        actorIds.get(statement.to) ?? statement.to,
        id,
      )
    }

    if (statement.kind === "activation") {
      addRelation("activates", id, actorIds.get(statement.target) ?? statement.target, id)
    }
  }

  const lowerGroup = (statement: MermaidGroupStatement, parentId: string | undefined, parentKey: string) => {
    const id = occurrenceId("mermaid", revision, statement.key)
    const structuralKey = `group:${parentKey}/${statement.form}:${statement.label}`
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

  return { language: "mermaid", occurrences, relations }
}

function lowerLeaf(
  statement: MermaidMessageStatement | MermaidActivationStatement | MermaidNoteStatement,
  id: string,
  parentId: string | undefined,
  parentKey: string,
): SequenceOccurrence {
  if (statement.kind === "message") {
    return {
      id,
      kind: "message",
      ...(parentId ? { parentId } : {}),
      ordinal: statement.ordinal,
      sourceSpan: statement.sourceSpan,
      structuralKey: `message:${parentKey}/${statement.from}${statement.arrow}${statement.to}:${statement.label}`,
      label: statement.label,
    }
  }

  if (statement.kind === "activation") {
    return {
      id,
      kind: "activation",
      ...(parentId ? { parentId } : {}),
      ordinal: statement.ordinal,
      sourceSpan: statement.sourceSpan,
      structuralKey: `activation:${parentKey}/${statement.action}:${statement.target}`,
      label: statement.action,
    }
  }

  return {
    id,
    kind: "note",
    ...(parentId ? { parentId } : {}),
    ordinal: statement.ordinal,
    sourceSpan: statement.sourceSpan,
    structuralKey: `note:${parentKey}/${statement.placement}:${statement.target}:${statement.label}`,
    label: statement.label,
  }
}
