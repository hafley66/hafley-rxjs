# Source order into initial layout

Status: proposed. Preserve source declaration order when ingestion has a source file.

```ts
type SourceOrder = { itemIds: readonly GraphId[]; sourceRevisionId: string }
function initialLayoutOrder(graph: Graph, source?: SourceOrder): readonly GraphId[] {
  // Retain surviving source IDs in declaration order; append synthetic IDs deterministically.
}
```

- Lifetime: create ordering metadata per ingested revision; carry it alongside graph and geometry.
- Storage/reads/writes: parser emits explicit ordered IDs; lowerers preserve them; initial layout reads them before assigning positions. No dependence on object-key enumeration or lexicographic ID sorting.
- Uniqueness: each graph ID occurs once; parent constraints and per-group sibling order remain explicit. Caller-supplied ordering takes precedence when supplied.
- Work: trace D2/Mermaid and row ingress; record where order is discarded; pass order into initial positions and supported solver ordering options. Manual placement is applied afterward. Report solver limits on final order.
- Acceptance: declaration reorder with unchanged IDs changes initial sibling ordering; formatting-only edits do not; synthetic nodes and nested groups have deterministic placement order. Source-less graphs retain a deterministic fallback.

References: [anim model ingest](/Users/chrishafley/projects/anim/src/core/d2.ts), [anim grid ordering](/Users/chrishafley/projects/anim/src/core/layout.ts), [grapht layout](/Users/chrishafley/projects/hafley-rxjs/packages/grapht/src/2_graph/12_layout.ts), [graph scope sorting](/Users/chrishafley/projects/hafley-rxjs/packages/grapht-model/src/6a_layoutParticipation.ts).
