# DOM group interaction and collapse parity

Status: partially implemented: actor view groups, shared visibility projection, and sequence-fragment compaction are connected in both proof renderers. Initial grouping may render group shells before leaf detail. Depends on [source order](0_source-order.md) for initial arrangement.

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


## Configurable layout ownership

Policy core and interactive lab implemented. Large-sequence collapse is connected; manual movement remains open.

- Each group starts automatic. A completed manual move switches only that group to manual.
- Collapse permits automatic placement of its collapsed representation.
- Toggle **auto layout on expand**: checked resumes automatic placement; unchecked restores the saved manual arrangement.
- The toggle affects expansion, not the current open arrangement. Saved positions are retained in both branches.
- Local positions and stable group identity belong to the caller; source reconciliation and undo remain separate.
- Evidence: `src/2_graph/15_groupLayout.ts`, `tests/15_groupLayout.test.ts`, and `adapters/2_render_cytoscape/proof/1_groupLayoutLab.ts`.

## Connected collapse evidence

`src/2_graph/17_groupProjection.ts` preserves topology and hides descendants/incident edges. `src/2_graph/18_sequenceCollapse.ts`
compacts sequence fragments from original geometry; `src/2_graph/20_groupActors.ts` adds source-preserving actor view
groups. The proof retains group/collapse state across renderer switches. Browser tests cover actor groups,
fragment collapse, restored visibility, and sealed-artifact validation. Actor lane spacing remains fixed;
boundary messages are hidden rather than aggregated. Source text remains unchanged.
