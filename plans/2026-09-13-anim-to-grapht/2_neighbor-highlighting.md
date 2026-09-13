# Neighbor modes, multi-selection, hover preview

Status: proposed. Port anim's graph queries and interaction flow into grapht presentation.

```ts
type NeighborMode = "neighbors" | "upstream" | "downstream" | "cone"
function neighborhood(graph, focus: readonly GraphId[], mode: NeighborMode): Neighborhood {
  // Reuse indexed adjacency; union per-focus results; return node/edge IDs and directional hops.
}
```

- Lifetime: adjacency per graph revision; committed focus and transient hover per view. Query support remains available to read-only consumers.
- Storage/reads/writes: focus and hover signals feed derived neighborhood/presentation signals. Hover writes only preview state; pointer exit restores committed presentation. Renderer consumes IDs and styles.
- Uniqueness: graph IDs join selection, adjacency, presentation, and detail. Multi-focus results use set union; keep incoming/outgoing distances separate so cycles do not erase direction evidence.
- Work: port cycle-safe queries; connect renderer events to caller-owned signals; replace direct focus-only presentation with neighborhood derivation. Preserve anim's faded context/isolation and modifier-key multi-selection.
- Acceptance: upstream/downstream/both/one-hop fixtures, cycles, multiple focals, induced edges, deselection, and graph revision changes. Hover must not commit selection, move camera, or append history.
- Boundary: intersection/subtraction or per-focus modes require explicit configuration design; the initial port preserves anim's union semantics.

References: [anim queries](/Users/chrishafley/projects/anim/src/core/views.ts), [anim painter and preview](/Users/chrishafley/projects/anim/src/AtlasPanel.tsx), [grapht presentation](/Users/chrishafley/projects/hafley-rxjs/packages/grapht/src/2_graph/9_operators.ts), [graph adjacency indexes](/Users/chrishafley/projects/hafley-rxjs/packages/grapht-model/src/6_graph.ts).
