---
created: 2026-08-25
updated: 2026-08-25
type: epic
owner: sol-high
status: done
priority: high
epic: grapht-renderer-platform
labels:
- model:sol-high
- size:large
- lane:research
size: L
lane: research
collision: [packages-grapht]
closed: 2026-08-25
---

# Reconcile Graphology topology contract

## Description

## Scope

Map current Grapht records to Graphology identity, mixed direction, multi-edge, self-edge, mutation-event, serialization, and hierarchy-sidecar semantics. Define hollow adapter signatures and migration seams. No call-site migration.

## Contract evidence

Hollow signatures live in `packages/grapht/src/28_graphologyContract.ts`. The
adapter boundary accepts the current `@hafley66/grapht-model` record and returns
a `GraphologyDocument`. No current caller changes shape in this issue.

Graphology is constructed with `{ type: "mixed", multi: true,
allowSelfLoops: true }`. Every canonical node is a Graphology node. Every
canonical edge also receives a Graphology `edge-endpoint` node so another edge
can address it without changing the canonical endpoint identity. Renderers and
ordinary node-only algorithms filter that anchor kind when their input domain
does not include relation nodes.

| Current field | Contract location | Ownership and mapping |
| --- | --- | --- |
| record key | `GraphologyIdentity` | Translated to a unique Graphology node or edge key and retained in both-direction lookup tables. |
| `GraphItem.id` | `graphId` attributes and identity maps | Retained as canonical Grapht identity; Graphology keys are transport identity. |
| `GraphItem.type` | node `kind` plus edge attributes | Translated to `node`, `edge-endpoint`, or `edge`; the canonical discriminant is recovered from the two topology kinds. |
| `GraphItem.parentId` | `GraphHierarchy.parentById` | Grapht-owned hierarchy sidecar; never inferred from Graphology adjacency. |
| `GraphItem.data` | node or edge `data` attribute | Retained in Graphology attributes and recovered once per canonical item. An edge's two physical legs carry equal data. |
| `GraphNode.layout` | `GraphHierarchy.layoutById` | Grapht-owned layout participation sidecar. |
| `GraphEdge.fromId` | physical source plus identity maps | Translated through `topologyNodeKeyByGraphId`; an edge endpoint resolves to its `edge-endpoint` node. |
| `GraphEdge.toId` | physical target plus identity maps | Translated through the same endpoint key map. |
| `GraphEdge.direction: "none"` | one undirected physical edge | One canonical edge, one Graphology edge key. |
| `GraphEdge.direction: "forward"` | one directed physical edge | One canonical edge, one source-to-target key. |
| `GraphEdge.direction: "both"` | one or two directed physical edges | A non-self edge has forward and reverse keys. A self-edge has one directed loop because reversing its endpoints produces the same incidence. |
| `GraphVisual.id` | `visuals[].id` | Grapht-owned visual identity retained verbatim. |
| `GraphVisual.graphId` | `visuals[].graphId` | Grapht-owned binding to canonical identity retained verbatim. |
| `GraphVisual.parts` | `visuals[].parts` | Grapht-owned renderer-neutral visual parts retained verbatim. |
| `GraphVisual.ports` | `visuals[].ports` | Retained for current compatibility; canonical port storage is the document `ports` sidecar. Import rejects disagreement between the two views. |
| `GraphPort.id` | `ports[].id` | Grapht-owned port identity retained verbatim. |
| `GraphPort.ownerId` | `ports[].ownerId` | Grapht-owned canonical attachment retained verbatim. |
| `GraphPort.location` | `ports[].location` | Grapht-owned geometry contract retained verbatim. |

### Direction, self, parallel, and edge endpoint cardinality

| Canonical edge case | Graphology nodes used as endpoints | Physical Graphology edges |
| --- | ---: | ---: |
| undirected A to B | 2 | 1 undirected |
| directed A to B | 2 | 1 directed |
| bidirectional A to B | 2 | 2 directed |
| undirected or directed A to A | 1 | 1 self-loop |
| bidirectional A to A | 1 | 1 directed self-loop with canonical direction retained by `GraphologyEdgeMapping` |
| parallel A to B relations | 2 shared endpoint nodes | 1 or 2 uniquely keyed edges per canonical relation |
| edge E1 to edge E2 | 2 `edge-endpoint` nodes | Physical edge legs for the new canonical relation |

The Graphology graph has one topology node per canonical graph item. Physical
edge count is the count of `none`, `forward`, and bidirectional-self edges plus
twice the count of bidirectional non-self edges. Graphology's `multi: true`
permits equal endpoint pairs while `GraphologyIdentity` keeps every physical
key unique.

### Instance timeline and lifetime

1. `graphologyDocumentOf` validates the canonical record before allocating one
   mixed multi-graph and its sidecars.
2. It allocates every topology node and both directions of the identity maps,
   then writes physical edges after every endpoint key exists.
3. `graphologyMutations` is cold. A downstream subscription attaches the
   Graphology event listeners, and unsubscription removes those listeners.
4. Canonical source replacement uses `switchMap`; the replaced document's
   mutation source unsubscribes before the next graph becomes active.
5. Serialization exports Graphology state and all Grapht sidecars in one
   `grapht-graphology/0` envelope. Parsing allocates a new graph instance and
   validates the envelope before returning it.

The topology instance and sidecars have the same document lifetime. Renderer
resources have a shorter mount lifetime and keep only handles keyed through the
document identity maps.

### Storage and read/write sequence

- Graphology stores incidence, mixed direction, self loops, parallel physical
  edges, topology attributes, and topology mutation events.
- Grapht stores hierarchy, layout participation, visuals, ports, canonical to
  physical identity maps, and physical-leg grouping.
- Canonical data is written once per canonical node and once logically per
  canonical edge. Bidirectional physical attributes must compare equal on
  import.
- A canonical mutation first resolves `graphId` through the identity map, then
  mutates Graphology, then updates affected Grapht sidecars, then emits the
  normalized mutation receipt.
- A Graphology mutation is read by physical key, translated to `graphId`, and
  accepted only when its attributes and leg membership agree with the identity
  maps.
- Serialization reads topology and sidecars after the same mutation boundary;
  import rebuilds inverse indexes and compares them before exposing the
  document.

### Uniqueness conditions

- `topologyNodeKeyByGraphId` and `graphIdByTopologyNodeKey` are a bijection.
- Every canonical item has exactly one topology node. Edge items use
  `kind: "edge-endpoint"`.
- Every physical edge key appears in exactly one `GraphologyEdgeMapping` and
  one inverse entry.
- One-leg mappings contain one key. Non-self bidirectional mappings contain two
  distinct keys. Bidirectional self mappings contain one key.
- Canonical graph IDs, visual IDs, visual part element IDs within one visual,
  and port IDs are unique in their declared domains.
- Parent references and edge endpoints resolve to canonical IDs. Parent cycles
  remain invalid.

### Counterexamples and stop conditions

- A directed-only Graphology instance rejects undirected relations; an
  undirected-only instance cannot preserve forward relations.
- `multi: false` aliases or rejects two canonical relations with equal
  endpoints.
- Disabling self loops rejects self messages and other reflexive relations.
- Representing bidirectionality with one ordinary directed A-to-B edge loses
  reverse traversal. Writing two loops for bidirectional A-to-A doubles degree
  without adding incidence.
- Resolving edge-to-edge endpoints to either source or target node changes the
  canonical relation. Import stops when an edge endpoint anchor is absent.
- Graphology's exported JSON alone omits hierarchy, layout, visual, port, and
  physical-leg ownership. Import requires the complete envelope.
- Import stops on non-bijective identity maps, unknown keys, mismatched leg
  attributes, an illegal physical direction, duplicate canonical IDs, missing
  endpoints, missing parents, or parent cycles.
- An algorithm that cannot exclude `edge-endpoint` nodes requires a later
  algorithm-specific projection. It does not receive the canonical topology
  directly.

## Acceptance Criteria

- [x] Mapping table names every retained, translated, and Grapht-owned field.
- [x] Type signatures cover directed, undirected, bidirectional, self, multi, and edge-to-edge cases.
- [x] Instance lifetime, storage, read/write sequence, and uniqueness rules are documented.
- [x] Counterexamples and stop conditions are recorded.

## Tests Run

- [x] Targeted TypeScript 7 `--noEmit` check passes for `28_graphologyContract.ts` against current workspace sources.
- [x] `git diff --check` reports no whitespace errors for the issue diff.

## Implementation Notes

- Added only declarations, type exports, the Graphology dependency record, and
  issue evidence. Renderer implementations and call sites are unchanged.
