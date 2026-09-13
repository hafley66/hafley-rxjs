# General graph identity and placement reconciliation

Status: proposed. Carry manual placement across source revisions using caller-selected identity rules.

```ts
type IdentityEvidence = { id: GraphId; path?: string; type: string; contentHash?: string }
function reconcileGraphPlacements(previous, next, placements, policy): Reconciliation {
  // Match unique identities by policy; rebase placements; return unmatched/ambiguous receipts.
}
```

- Lifetime: one identity record per graph item per source revision; placement records survive revisions independently of renderer instances.
- Storage/reads/writes: keep stable identity, source path/type/content evidence, and manual offsets separately. Read previous/next evidence; write rebased placements and explicit blocked matches.
- Uniqueness: caller ID is authoritative when configured; path/type and content matching are selectable fallbacks. Hash equality alone cannot resolve duplicate content. Distinguish coordinate movement, source reparenting, and content edits.
- Work: generalize existing sequence reconciliation without replacing its compatibility behavior; expose matching policy at the graph boundary. Define canonical content inputs and retain collision/ambiguity evidence.
- Acceptance: fixtures cover rename, reparent, content edit, insertion, deletion, reorder, duplicate content, and conflicting IDs. Unrelated placements remain unchanged; ambiguous matches are reported without silently transferring offsets.
- Decision to expose: matching precedence belongs to the caller/source adapter; no global registry.

References: [sequence identity](/Users/chrishafley/projects/hafley-rxjs/packages/grapht-model/src/0_sequenceIdentity.ts), [placement reconciliation](/Users/chrishafley/projects/hafley-rxjs/packages/grapht-model/src/4_sequencePlacement.ts), [anim identity keys](/Users/chrishafley/projects/anim/src/core/model.ts).
