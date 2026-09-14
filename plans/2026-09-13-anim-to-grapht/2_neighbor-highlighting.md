# Neighbor modes, multi-selection, hover preview

Status: partially implemented. Directional hover modes, hop gradients, sequence-step traversal, and debug hover are connected in both proof renderers. Committed multi-selection combinations remain proposed.

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

## Connected hover evidence

- `packages/grapht/src/2_graph/16_neighborhood.ts`: breadth-first actor/general adjacency.
- `packages/grapht-model/src/8_sequenceFlow.ts`: ordered message transitions with parallel fork/join.
- `packages/grapht/src/2_graph/19_sequenceNeighborhood.ts`: event hops projected onto messages and actor endpoints.
- `packages/grapht/adapters/2_render_cytoscape/proof/live.ts`: caller-owned hover input and mode/depth controls; debug IDs, anchors, bindings, and relations.
- Renderer `applyHover` updates paint without geometry rebuilds or momentum cancellation.
- Validation: deterministic branch/cycle tests, DOM/native opacity and picking tests, built proof UI checks.
