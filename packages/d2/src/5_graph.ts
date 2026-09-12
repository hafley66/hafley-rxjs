import { type SequenceGraph, sequenceDocumentToGraph } from "@hafley66/grapht-model"
import type { D2SequenceDocument } from "./0_types.js"
import { identifyD2Occurrences } from "./2_identity.js"

export function d2Graph(document: D2SequenceDocument): SequenceGraph {
  return sequenceDocumentToGraph(identifyD2Occurrences(document))
}
