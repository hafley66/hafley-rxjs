import { type SequenceGraph, sequenceDocumentToGraph } from "@hafley66/grapht-model"
import type { MermaidSequenceDocument } from "./0_types.js"
import { identifyMermaidOccurrences } from "./2_identity.js"

export function mermaidGraph(document: MermaidSequenceDocument): SequenceGraph {
  return sequenceDocumentToGraph(identifyMermaidOccurrences(document))
}
