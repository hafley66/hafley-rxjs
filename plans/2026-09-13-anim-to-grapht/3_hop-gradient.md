# Hop-distance highlight gradient

Status: proposed. Depends on [neighbor queries](2_neighbor-highlighting.md).

```ts
function hopOpacity(hop: number, decay: number, floor: number): number {
  // First hop = 1; later hops = max(floor, decay ** (hop - 1)); focal styling is separate.
}
```

- Lifetime: derive styles for each current focus/preview result; no stored gradient history.
- Storage/reads/writes: read directional hop maps and caller style configuration; write per-ID opacity into graph presentation. Renderers apply the same derived values.
- Uniqueness: for multiple focals, nearest eligible hop wins. Preserve direction color while reducing alpha; carry both directions where a node belongs to both closures.
- Proposed edge rule: use the farther endpoint's eligible hop for each direction, so focal-to-first-hop edges receive full strength. Configure overlapping-direction color explicitly.
- Work: add a shared pure style derivation, presentation fields, and supported renderer mappings. Keep isolated/faded-context visibility and transient preview strength separate from distance alpha.
- Acceptance: deterministic 0/1/2/3-hop panel, branching, cycles, multiple focals, direction overlap, and hover restoration. Verify first hop is strongest and subsequent hops monotonically fade with the same hue.
- Configuration: caller supplies decay/floor and direction colors; choose visual defaults during the fixture review.

References: [anim signed hops](/Users/chrishafley/projects/anim/src/core/views.ts), [anim hop labels](/Users/chrishafley/projects/anim/src/AtlasPanel.tsx), [grapht presentation contract](/Users/chrishafley/projects/hafley-rxjs/packages/grapht/src/2_graph/0_frame.ts).
