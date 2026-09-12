import type { SequenceOccurrenceDocument, SequenceSourceSpan } from "./0_sequenceIdentity.js"
import type { Graph } from "./6_graph.js"

export type SequenceGraphNodeData = {
  kind: "actor" | "group" | "activation" | "note"
  label?: string
  authoredId?: string
  structuralKey: string
  ordinal: number
  sourceSpan?: SequenceSourceSpan
  activationTarget?: string
}

export type SequenceGraphEdgeData = {
  kind: "message"
  label?: string
  ordinal: number
  sourceSpan?: SequenceSourceSpan
}

export type SequenceGraph = Graph<SequenceGraphNodeData, SequenceGraphEdgeData>

export function sequenceDocumentToGraph(document: SequenceOccurrenceDocument): SequenceGraph {
  const graph: Record<string, SequenceGraph[keyof SequenceGraph]> = {}
  const messageTargets = new Map<string, { fromId: string; toId: string }>()

  for (const relation of document.relations) {
    if (relation.kind === "message" && relation.occurrenceId) {
      messageTargets.set(relation.occurrenceId, { fromId: relation.sourceId, toId: relation.targetId })
    }
  }

  for (const occurrence of document.occurrences) {
    if (occurrence.kind === "message") {
      const endpoints = messageTargets.get(occurrence.id)
      if (endpoints === undefined) {
        throw new Error(`message occurrence ${occurrence.id} has no message relation`)
      }
      graph[occurrence.id] = {
        id: occurrence.id,
        type: "edge",
        ...(occurrence.parentId ? { parentId: occurrence.parentId } : {}),
        fromId: endpoints.fromId,
        toId: endpoints.toId,
        direction: "forward",
        data: {
          kind: "message",
          ...(occurrence.label !== undefined ? { label: occurrence.label } : {}),
          ordinal: occurrence.ordinal,
          ...(occurrence.sourceSpan ? { sourceSpan: occurrence.sourceSpan } : {}),
        },
      }
      continue
    }

    const activation = document.relations.find(
      relation => relation.kind === "activates" && relation.sourceId === occurrence.id,
    )

    graph[occurrence.id] = {
      id: occurrence.id,
      type: "node",
      ...(occurrence.parentId ? { parentId: occurrence.parentId } : {}),
      data: {
        kind: occurrence.kind,
        ...(occurrence.label !== undefined ? { label: occurrence.label } : {}),
        ...(occurrence.authoredId !== undefined ? { authoredId: occurrence.authoredId } : {}),
        structuralKey: occurrence.structuralKey,
        ordinal: occurrence.ordinal,
        ...(occurrence.sourceSpan ? { sourceSpan: occurrence.sourceSpan } : {}),
        ...(activation ? { activationTarget: activation.targetId } : {}),
      },
    }
  }

  return graph
}
