# DOM group interaction and collapse parity

Status: proposed. Initial grouping may render group shells before leaf detail. Depends on [source order](0_source-order.md) for initial arrangement.

```ts
type GroupMove = { ids: readonly GraphId[]; before: Positions; after: Positions }
function projectGroups(graph, geometry, collapsedIds): GroupProjection {
  // Resolve descendants and boundary edges; reuse existing scope/projection behavior where applicable.
}
```

- Lifetime: graph/group metadata per revision; collapsed state and drag preview per interactive view; renderer resources end through `unsubscribe`.
- Storage/reads/writes: caller owns collapsed IDs and positions. Pointer movement previews world-coordinate deltas; completed group drag emits one move containing affected IDs and before/after positions.
- Uniqueness: group IDs remain stable; parent/descendant indexes determine membership. Collapsing preserves member identity for expansion and placement restoration.
- Work: trace anim's headless Cytoscape-to-DOM layout and group boxes; use the existing renderer/library surface. Implement the missing DOM collapse path against shared projection semantics. Render first-pass shells without requiring leaf-count decoration.
- Scoped layout: identify the changed group and affected ancestor bounds; preserve unrelated geometry; define boundary-edge routing and behavior when a group outgrows its allocated bounds before adding a dirty-path layout API.
- Acceptance: nested collapse/expand, group drag at zoom, unchanged unrelated positions, crossing edges, and renderer-switch state retention. Compare canvas and DOM visible IDs/bounds; expanded geometry and manual offsets restore exactly.
- Existing gap: anim canvas uses the collapse plugin; its CSS collapse methods are no-ops. Sequence vertical collapse does not establish arbitrary graph collapse behavior.

References: [anim DOM renderer](/Users/chrishafley/projects/anim/src/CssGraph.ts), [canvas collapse wiring](/Users/chrishafley/projects/anim/src/AtlasPanel.tsx), [grapht sealed scopes](/Users/chrishafley/projects/hafley-rxjs/packages/grapht/src/2_graph/2_geometryScope.ts), [sequence projection](/Users/chrishafley/projects/hafley-rxjs/packages/grapht/src/1_sequence/5_collapse.ts), [geometry translation](/Users/chrishafley/projects/hafley-rxjs/packages/grapht/src/2_graph/5_translateGeometry.ts).
