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

# Reconcile visual geometry and port contract

## Description

## Scope

Specify renderer-neutral GraphVisual parts, nested grouping, PortLocation unions, path-offset orientation, attachment, geometry propagation, and sticky-stack inputs.

## Contract evidence

Hollow signatures live in `packages/grapht/src/31_visualPortContract.ts`.
They extend the committed `GraphVisual`, `GraphPort`, `PortLocation`,
`ResolvedPortLocation`, `GraphGeometry`, and Graphology document contracts
without changing renderer implementations or callers.

### Identity and storage domains

| Domain | Identity | Stored value | Lifetime |
| --- | --- | --- | --- |
| semantic | `GraphSemanticIdentity.graphId` | node or edge meaning and data | document |
| topology | canonical graph ID plus Graphology node and edge keys | incidence, direction, self and parallel edges | topology instance |
| visual | `(graphId, visualId)` | renderer-neutral group of visual parts and ports | document |
| visual part | `(graphId, visualId, partId)` | one shape, label, line, route, frame, activation, or note part | document |
| geometry | `graphId`, `partId`, and `portId` lookup keys | bounds, routes, transforms, position, tangent, normal, angle | geometry revision |
| renderer handle | `(renderer, resourceId, graphId, visualId, partId?)` | Cytoscape element, Pixi display object, or compatibility handle | active renderer resource |

Semantic IDs never become SVG element IDs or renderer handles. Graphology keys
carry topology transport identity. Visual IDs and part IDs bind one canonical
identity to grouped rendering. Geometry contains values and no native handles.
Renderer handle identity includes the resource ID so a handle from a replaced
resource cannot be accepted by the next renderer.

`GraphVisualContract.layout` is required. A `SequenceRootVisualContract` and a
`SealedDiagramVisualContract` require `mode: "sealed"`, concrete bounds, and a
geometry revision ID. Descendants of a sealed diagram retain semantic and
visual identity while the outer layout sees the sealed root as one atomic node.

### Movement propagation

`graphTranslatePlan(document, geometry, graphId, delta)` computes immutable,
sorted affected-ID lists before any geometry write. `applyGraphTranslate`
applies that plan once and returns the next `GraphVisualFrame`.

1. Resolve the translated canonical item and its descendant closure through
   `GraphHierarchy.childrenByParentId`.
2. Add every visual in the closure. All visual parts move together, including
   group frames, group labels, actor shapes, actor labels, lifelines,
   activations, notes, and node labels.
3. Add every port owned by a moved item. Resolve port positions after owner
   bounds and referenced paths receive their new geometry.
4. Inspect every canonical edge incident to a moved endpoint, including an
   edge-to-edge endpoint anchor.
5. When exactly one endpoint moves, translate that endpoint of the route and
   preserve interior bends until a layout or reroute result replaces them.
6. When both endpoints move by the same delta, translate the whole route. A
   self-edge therefore moves as one route rather than translating only its
   duplicated endpoint.
7. Recompute edge-label geometry from the resulting route. Whole-route motion
   translates label parts by the same delta; one-endpoint motion recomputes
   their route-relative placement.
8. Build sticky-stack input from translated natural group-label bounds,
   hierarchy depth, and the current viewport. Sticky placement remains a
   presentation result and does not overwrite natural geometry.

A parent translation contributes once to each descendant's effective
translation. A child with its own translate value composes that value after its
ancestor translation. The write sequence avoids applying the parent delta a
second time when walking the descendant list.

### Layout participation

| Visual root | Required declaration | Outer-layout behavior |
| --- | --- | --- |
| sequence root | `{ mode: "sealed", bounds, geometryRevisionId, ports? }` | root enters as one atomic node; descendant geometry is composed inside its bounds and never enters the generic layout |
| sealed non-sequence diagram | the same sealed form | diagram enters as one atomic node with explicit attachment candidates |
| excluded visual | `{ mode: "excluded" }` | visual and descendants have no outer-layout endpoint |

An omitted declaration on a sequence root or sealed diagram stops frame
resolution. `data.layout` is ordinary user data and cannot satisfy this field.

### Five deterministic port examples

The examples use owner bounds `{ x: 10, y: 20, width: 100, height: 50 }` and
path `route = [0, 0, 100, 0, 100, 100]`. `FivePortLocationExamples` fixes the
input tuple in the TypeScript contract.

| Kind and input | Position | Tangent | Normal | Angle |
| --- | --- | --- | --- | ---: |
| `absolute`, point `(7, 8)` | `(7, 8)` | `(1, 0)` | `(0, 1)` | `0` |
| `relative-box`, `(0.25, 0.5)` | `(35, 45)` | `(1, 0)` | `(0, 1)` | `0` |
| `side`, right at ratio `0.5`, tangent orientation | `(110, 45)` | `(0, 1)` | `(-1, 0)` | `π / 2` |
| `boundary`, length `125`, lateral `3`, reverse tangent | `(107, 45)` | `(0, 1)` | `(-1, 0)` | `3π / 2` |
| `path`, route ratio `0.75`, lateral `4`, fixed angle `1.25` | `(96, 50)` | `(0, 1)` | `(-1, 0)` | `1.25` |

Ratio offsets multiply total path length. Length offsets use geometry units.
Both clamp to the inclusive path extent. Lateral offset follows the resolved
left normal. `none` orientation yields angle zero, tangent uses the sampled
tangent angle, reverse tangent adds π, and fixed returns its declared angle.

### Instance timeline and lifetime

1. A document revision supplies topology, hierarchy, visuals, ports, and
   explicit root layout participation.
2. A geometry revision supplies canonical bounds and routes. It remains valid
   until topology, layout inputs, sealed geometry, or translations change.
3. `resolveGraphVisuals` joins visual and geometry values into one resolved
   visual array. Part and port resolution has that geometry-revision lifetime.
4. A translate event produces one plan and one next visual frame. The previous
   frame remains immutable for renderer diffing.
5. Sticky input derives from the current resolved frame and viewport.
6. The active renderer lowers the frame into handles scoped to its resource.
   Renderer replacement ends every old handle through `unsubscribe` while the
   semantic, visual, and geometry values remain available to the next lowering.

### Read/write sequence, uniqueness, and cardinality

- Document reads resolve semantic ID, topology key, hierarchy, visual, parts,
  and ports. Geometry reads follow only after those identities validate.
- One canonical graph item has one primary `GraphVisual`. A visual contains
  zero or more ordered parts and zero or more ports.
- `(visualId, partId)` is unique; `portId` is unique across the document; every
  part and port resolves to exactly one canonical owner.
- One resolved part has one bounds value and one effective translate value per
  frame. One resolved port has one position, tangent, normal, and angle.
- A renderer resource may create one primary handle per visual and internal
  handles per part. All handle identities include one active `resourceId`.
- Translate plans sort and deduplicate every affected-ID list. A group with `n`
  descendants visits each descendant once. Each incident edge enters either
  `routeEndpointIds` or `wholeRouteIds` once.
- Geometry writes create a new revision ID. Topology, visuals, and ports remain
  unchanged unless their own source revision changes.

### Counterexamples and stop conditions

- Moving an actor shape without its label and lifeline splits one visual group.
- Applying a group delta to a child and then applying the same inherited delta
  during child traversal doubles movement.
- Resolving ports before translated owner bounds or routes leaves attached edge
  endpoints at the old coordinates.
- Translating one endpoint of a self-edge distorts the route. Self-edge motion
  uses `wholeRouteIds`.
- Translating both endpoints of an internal group edge while preserving its
  interior points stretches a route that should move rigidly.
- Moving an edge route without recomputing its label leaves the label detached.
- A missing path ID, a path with fewer than two coordinate pairs, an all-zero
  path, duplicate part or port IDs, an unknown owner, a missing explicit root
  layout declaration, or a renderer handle from another resource stops
  resolution.
- SVG parent traversal, DOM order, or renderer scene ancestry cannot supply
  semantic ownership when the visual-part binding is absent.

## Acceptance Criteria

- [x] Signatures separate semantic identity, topology, visual parts, geometry, and renderer handles.
- [x] Movement propagation is defined for group labels, children, ports, edges, and edge labels.
- [x] Sequence roots and sealed diagrams declare layout participation explicitly.
- [x] Five port-location forms have deterministic examples.

## Tests Run

- [x] Targeted TypeScript 7 `--noEmit` check passes for all four hollow contract signature files against current workspace sources.
- [x] Existing inline snapshots in `6c_resolvePortLocation.test.ts`, `6d_graphVisual.test.ts`, and `20e_translateGraphGeometry.test.ts` match the documented port and movement evidence.
- [x] `git diff --check` reports no whitespace errors for the issue diff.

## Implementation Notes

- Added only declarations, type-only exports, and issue evidence. Renderer
  implementations, tests, examples, and call sites are unchanged.
